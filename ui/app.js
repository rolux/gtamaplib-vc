import { GtaTileMap } from "/ui/map.js";

const state = {
  data: null,
  view: "camera",
  camera: null,
  landmark: null,
  pendingFocusLandmark: false,
  dragging: false,
  scale: 1,
  panX: 0,
  panY: 0,
  focus: "cameras",
  hoveredCone: null,
  pendingCameraFit: null,
  pendingMapFocus: true,
  panelPreviewRequest: 0,
  editMode: false,
  renameMode: false,
  editingObservation: null,
  settings: {
    useMonospaceFont: false,
    showCameraIDs: false,
    onlyShowCamerasForSelectedLandmark: false,
    blurLeaks: false,
  },
  map: {
    centerX: 0,
    centerY: 0,
    zoom: 2.2,
  },
};

const STORAGE = {
  sortCameras: "gtamaplibvc.sortCameras",
  sortLandmarks: "gtamaplibvc.sortLandmarks",
  useMonospaceFont: "gtamaplibvc.useMonospaceFont",
  showCameraIDs: "gtamaplibvc.showCameraIDs",
  onlyShowCamerasForSelectedLandmark: "gtamaplibvc.onlyShowCamerasForSelectedLandmark",
  blurLeaks: "gtamaplibvc.blurLeaks",
};

const MIN_VISIBLE_IMAGE_PX = 64;
const MAP_FOCUS_ZOOM = 3.05;
const KEYBOARD_PAN_AMOUNT = 0.025;
const KEYBOARD_ZOOM_AMOUNT = 0.025;
const KEYBOARD_FRAME_MS = 1000 / 60;
const DISABLE_MAP_SVG_OVERLAY = false;
const FAKE_CAMERA_SUFFIX = " Fake Cam";
const FOCUS_ORDER = ["cameras", "map", "landmarks"];

const els = {
  cameraFind: document.querySelector("#camera-find"),
  cameraFindClear: document.querySelector("#camera-find-clear"),
  settingsButton: document.querySelector("#settings-button"),
  viewSelect: document.querySelector("#view-select"),
  cameraSort: document.querySelector("#camera-sort"),
  cameraPanel: document.querySelector("#camera-panel"),
  cameraList: document.querySelector("#camera-list"),
  cameraStatus: document.querySelector("#camera-status"),
  landmarkFind: document.querySelector("#landmark-find"),
  landmarkFindClear: document.querySelector("#landmark-find-clear"),
  landmarkSort: document.querySelector("#landmark-sort"),
  landmarkPanel: document.querySelector("#landmark-panel"),
  landmarkList: document.querySelector("#landmark-list"),
  landmarkStatus: document.querySelector("#landmark-status"),
  cameraPreview: document.querySelector("#camera-preview"),
  cameraMapPreview: document.querySelector("#camera-map-preview"),
  cameraImagePreview: document.querySelector("#camera-image-preview"),
  viewport: document.querySelector("#viewport"),
  stage: document.querySelector("#stage"),
  frame: document.querySelector("#frame"),
  mapCanvas: document.querySelector("#map-canvas"),
  guidesOverlay: document.querySelector("#guides-overlay"),
  previewCanvas: document.querySelector("#preview-canvas"),
  overlay: document.querySelector("#overlay"),
  title: document.querySelector("#selection-title"),
  cameraData: document.querySelector("#camera-data"),
  landmarkData: document.querySelector("#landmark-data"),
  addObservation: document.querySelector("#add-observation"),
  editObservation: document.querySelector("#edit-observation"),
  renameLandmark: document.querySelector("#rename-landmark"),
  removeObservation: document.querySelector("#remove-observation"),
  dialogBackdrop: document.querySelector("#dialog-backdrop"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogContent: document.querySelector("#dialog-content"),
  dialogClose: document.querySelector("#dialog-close"),
};

const byCamera = new Map();
const byLandmark = new Map();
const cameraByName = new Map();
const landmarkByName = new Map();
const previewImages = new Map();
let previewRequest = 0;
let pendingMapRender = null;
const keyboardNavigation = {
  keys: new Set(),
  frame: null,
  timestamp: null,
};
const tileMap = new GtaTileMap();
tileMap.onLoad = () => {
  if (state.view === "map") scheduleMapRender();
  else renderCameraPreview();
};

function mapPointFromXyz(xyz) {
  const map = state.data?.map;
  if (!map || !xyz) return null;
  return {
    x: map.zero[0] + xyz[0] * map.scale,
    y: map.zero[1] - xyz[1] * map.scale,
  };
}

function isUserFacingCameraName(name) {
  return !name.endsWith(FAKE_CAMERA_SUFFIX);
}

function applyWorldSnapshot(snapshot) {
  if (!snapshot || snapshot.schema !== "gtamaplibvc-world-v1") return;
  const snapshotCameras = snapshot.cameras || {};
  const snapshotLandmarks = snapshot.landmarks || {};
  const snapshotLandmarkSources = snapshot.landmark_sources || {};
  for (const camera of state.data.cameras) {
    const current = snapshotCameras[camera.name];
    if (!current) continue;
    camera.player = current.player;
    camera.xyz = current.xyz;
    camera.ypr = current.ypr;
    camera.fov = current.fov;
    camera.map = mapPointFromXyz(current.xyz);
  }
  const existingLandmarks = new Set(state.data.landmarks.map((landmark) => landmark.name));
  for (const landmark of state.data.landmarks) {
    const xyz = snapshotLandmarks[landmark.name];
    if (!xyz) continue;
    if (!landmark.xyz && snapshotLandmarkSources[landmark.name] === "gtamaplib") continue;
    landmark.xyz = xyz;
    landmark.map = mapPointFromXyz(xyz);
  }
  for (const [name, xyz] of Object.entries(snapshotLandmarks)) {
    if (existingLandmarks.has(name)) continue;
    if (snapshotLandmarkSources[name] === "gtamaplib") continue;
    state.data.landmarks.push({
      name,
      order: state.data.landmarks.length,
      xyz,
      color: landmarkColor(name),
      observation_count: byLandmark.get(name)?.length || 0,
      map: mapPointFromXyz(xyz),
    });
  }
}

function cameraLabel(camera) {
  if (state.settings.showCameraIDs && camera?.id) return `[${camera.id}] ${camera.name}`;
  return camera.name;
}

function landmarkLabel(name) {
  return `${name}`;
}

function landmarkColor(name) {
  return landmarkByName.get(name)?.color || byLandmark.get(name)?.[0]?.color || "#fff";
}

function landmarkObservationCount(name) {
  const count = byLandmark.get(name)?.length ?? landmarkByName.get(name)?.observation_count ?? 0;
  return Math.max(1, count);
}

function cameraObservationCount(name) {
  return byCamera.get(name)?.length ?? cameraByName.get(name)?.observation_count ?? 0;
}

function cameraIdSortKey(id) {
  const match = String(id || "").match(/^([A-Z])(\d+)(?:\/(\d+))?/i);
  if (!match) return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, String(id || "")];
  const letterOrder = { L: 0, T: 1, S: 2 };
  const letter = match[1].toUpperCase();
  return [
    Number(match[2]),
    letterOrder[letter] ?? Number.POSITIVE_INFINITY,
    match[3] === undefined ? Number.POSITIVE_INFINITY : Number(match[3]),
    String(id || ""),
  ];
}

function compareCameraIds(a, b) {
  const aKey = cameraIdSortKey(a.id);
  const bKey = cameraIdSortKey(b.id);
  for (let i = 0; i < aKey.length; i += 1) {
    if (aKey[i] < bKey[i]) return -1;
    if (aKey[i] > bKey[i]) return 1;
  }
  return a.order - b.order;
}

function shouldBlurCamera(camera) {
  return Boolean(state.settings.blurLeaks && camera?.id?.startsWith("L"));
}

function svg(tag, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value).toFixed(3) : null;
}

function formatTuple(values) {
  if (!values) return null;
  const formatted = values.map(formatNumber);
  if (formatted.some((value) => value === null)) return null;
  return `(${formatted.join(", ")})`;
}

function renderStatus(target, name, fields) {
  target.replaceChildren();
  if (!name) return;

  const nameSpan = document.createElement("span");
  nameSpan.className = "status-name";
  nameSpan.textContent = name;
  target.append(nameSpan);

  for (const [label, value] of fields) {
    if (!value) continue;
    const fieldSpan = document.createElement("span");
    fieldSpan.className = "status-field";
    fieldSpan.textContent = `${label} ${value}`;
    target.append(fieldSpan);
  }
}

function updateGlobalStatus() {
  if (state.camera) {
    renderStatus(els.cameraData, cameraLabel(state.camera), [
      ["XYZ", formatTuple(state.camera.xyz)],
      ["YPR", formatTuple(state.camera.ypr)],
      ["FOV", formatTuple(state.camera.fov)],
    ]);
  } else {
    els.cameraData.replaceChildren();
  }

  if (state.landmark) {
    const landmark = landmarkByName.get(state.landmark);
    renderStatus(els.landmarkData, state.landmark, [["XYZ", formatTuple(landmark?.xyz)]]);
  } else {
    els.landmarkData.replaceChildren();
  }
}

function updateEditTools() {
  const canAdd = state.view === "camera" && Boolean(state.camera);
  const canEditObservation = state.view === "camera" && Boolean(state.camera && state.landmark);
  const canRenameGlobally = Boolean(state.landmark && !state.camera);
  els.addObservation.hidden = !canAdd;
  els.editObservation.hidden = !canEditObservation;
  els.removeObservation.hidden = !canEditObservation;
  els.renameLandmark.hidden = !canRenameGlobally;
  els.editObservation.classList.toggle("active", state.editMode);
  els.renameLandmark.classList.toggle("active", state.renameMode);
  els.editObservation.textContent = state.editMode ? "Done" : "Edit";
  els.renameLandmark.textContent = state.renameMode ? "Done" : "Rename";
}

function storedBoolean(key, fallback) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
}

function setStoredBoolean(key, value) {
  localStorage.setItem(key, value ? "true" : "false");
}

function setFocus(zone) {
  if (!FOCUS_ORDER.includes(zone)) return;
  state.focus = zone;
  document.body.dataset.focus = zone;
}

function applyGlobalSettings() {
  document.body.classList.toggle("use-monospace-font", state.settings.useMonospaceFont);
  document.body.dataset.focus = state.focus;
}

function refreshSettingsDependentViews() {
  applyGlobalSettings();
  renderCameraList();
  updateGlobalStatus();
  if (state.camera) {
    els.frame.classList.toggle("blurred-leak-frame", shouldBlurCamera(state.camera));
    renderCameraPreview();
  }
  clearPreview();
  if (state.view === "map") scheduleMapRender();
}

function settingCheckbox(label, key) {
  const row = document.createElement("label");
  row.className = "setting-row";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(state.settings[key]);
  input.addEventListener("change", () => {
    state.settings[key] = input.checked;
    setStoredBoolean(STORAGE[key], input.checked);
    refreshSettingsDependentViews();
  });
  const text = document.createElement("span");
  text.textContent = label;
  row.append(input, text);
  return row;
}

function openDialog(title, content) {
  els.dialogTitle.textContent = title;
  els.dialogContent.replaceChildren(content);
  els.dialogBackdrop.hidden = false;
}

function closeDialog() {
  els.dialogBackdrop.hidden = true;
  els.dialogBackdrop.classList.remove("clicked");
  els.dialogContent.replaceChildren();
}

function openSettingsDialog() {
  const content = document.createElement("div");
  content.className = "settings-list";
  content.append(
    settingCheckbox("Use monospace font", "useMonospaceFont"),
    settingCheckbox("Show camera IDs", "showCameraIDs"),
    settingCheckbox("Only show cameras for selected landmark", "onlyShowCamerasForSelectedLandmark"),
    settingCheckbox("Blur leaks", "blurLeaks"),
  );
  openDialog("Settings", content);
}

function filteredCameras() {
  const query = els.cameraFind.value.trim().toLowerCase();
  const items = state.data.cameras.filter((camera) => {
    const matchesQuery = !query || camera.name.toLowerCase().includes(query) || camera.id.toLowerCase().includes(query);
    const matchesLandmark =
      !state.settings.onlyShowCamerasForSelectedLandmark ||
      !state.landmark ||
      (byCamera.get(camera.name) || []).some((observation) => observation.landmark === state.landmark);
    return matchesQuery && matchesLandmark;
  });
  const sort = els.cameraSort.value;
  items.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "observations") return b.observation_count - a.observation_count || a.order - b.order;
    if (sort === "ID") return compareCameraIds(a, b);
    return a.order - b.order;
  });
  return items;
}

function selectedObservations() {
  const observations = state.camera
    ? byCamera.get(state.camera.name) || []
    : [...byLandmark.keys()].map((landmark) => ({ landmark }));
  const query = els.landmarkFind.value.trim().toLowerCase();
  const items = observations.filter((observation) => {
    return !query || observation.landmark.toLowerCase().includes(query);
  });
  if (els.landmarkSort.value === "name") {
    items.sort((a, b) => a.landmark.localeCompare(b.landmark));
  } else if (els.landmarkSort.value === "observations") {
    items.sort((a, b) => landmarkObservationCount(b.landmark) - landmarkObservationCount(a.landmark) || a.landmark.localeCompare(b.landmark));
  } else if (els.landmarkSort.value === "ID") {
    items.sort((a, b) => {
      const aOrder = landmarkByName.get(a.landmark)?.order ?? Number.POSITIVE_INFINITY;
      const bOrder = landmarkByName.get(b.landmark)?.order ?? Number.POSITIVE_INFINITY;
      return aOrder - bOrder || a.landmark.localeCompare(b.landmark);
    });
  }
  return items;
}

function renderCameraList() {
  const cameras = filteredCameras();
  els.cameraFindClear.hidden = !els.cameraFind.value;
  els.cameraList.replaceChildren();
  for (const camera of cameras) {
    const row = document.createElement("div");
    row.className = "item";
    if (state.camera && state.camera.name === camera.name) row.classList.add("selected");
    row.innerHTML = `
      <span class="item-name"></span>
      <span class="item-meta">${cameraObservationCount(camera.name)}</span>
    `;
    row.style.borderLeftColor = camera.color;
    const nameSlot = row.querySelector(".item-name");
    nameSlot.textContent = cameraLabel(camera);
    row.title = camera.name;
    row.addEventListener("mousedown", (event) => {
      setFocus("cameras");
      selectCamera(camera.name, event.metaKey || event.ctrlKey, true);
    });
    els.cameraList.append(row);
  }
  els.cameraStatus.textContent = `${cameras.length} of ${state.data.cameras.length} Cameras`;
  updateEditTools();
}

function cameraRows() {
  return filteredCameras();
}

function renderLandmarkList() {
  const observations = selectedObservations();
  els.landmarkFindClear.hidden = !els.landmarkFind.value;
  els.landmarkList.replaceChildren();
  for (const observation of observations) {
    const isSelected = state.landmark === observation.landmark;
    const isEditing = isSelected && ((state.editMode && state.camera) || (state.renameMode && !state.camera));
    const row = document.createElement("div");
    row.className = "item";
    if (isSelected) row.classList.add("selected");
    row.innerHTML = `
      <span class="item-name"></span>
      <span class="item-meta">${landmarkObservationCount(observation.landmark)}</span>
    `;
    row.style.borderRightColor = landmarkColor(observation.landmark);
    const nameSlot = row.querySelector(".item-name");
    if (isEditing) {
      const input = document.createElement("input");
      let cancelled = false;
      let submitted = false;
      input.className = "item-name-input";
      input.value = observation.landmark;
      const submit = (finish = false) => {
        if (cancelled || submitted) return;
        submitted = true;
        const value = input.value;
        input.blur();
        if (state.camera) commitLocalObservationName(value, finish);
        else commitGlobalLandmarkName(value, finish);
      };
      input.addEventListener("mousedown", (event) => event.stopPropagation());
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          submit(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelled = true;
          input.blur();
          cancelObservationEditMode();
        }
      });
      input.addEventListener("blur", () => {
        submit();
      });
      nameSlot.replaceWith(input);
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    } else {
      nameSlot.textContent = landmarkLabel(observation.landmark);
    }
    row.title = observation.landmark;
    row.addEventListener("mousedown", (event) => {
      setFocus("landmarks");
      if (isEditing && event.target.classList.contains("item-name-input")) return;
      selectLandmark(observation.landmark, true, event.metaKey || event.ctrlKey);
    });
    els.landmarkList.append(row);
  }
  els.landmarkStatus.textContent = `${observations.length} of ${byLandmark.size} Landmarks`;
  updateEditTools();
}

function landmarkRows() {
  return selectedObservations();
}

function setStageSize(width, height, isMap = false) {
  els.stage.style.width = `${width}px`;
  els.stage.style.height = `${height}px`;
  els.stage.classList.toggle("is-map", isMap);
  els.frame.style.width = `${width}px`;
  els.frame.style.height = `${height}px`;
  els.frame.classList.toggle("map-image", isMap);
  els.mapCanvas.style.width = `${isMap ? width : 0}px`;
  els.mapCanvas.style.height = `${isMap ? height : 0}px`;
  resizePreviewCanvas();
  els.guidesOverlay.setAttribute("width", width);
  els.guidesOverlay.setAttribute("height", height);
  els.guidesOverlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
  els.overlay.setAttribute("width", width);
  els.overlay.setAttribute("height", height);
  els.overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const guideScale = width / 320;
  els.guidesOverlay.style.setProperty("--vertical-guide-width", `${0.125 * guideScale}px`);
  els.guidesOverlay.style.setProperty("--horizon-guide-width", `${0.25 * guideScale}px`);
}

function currentStageSize() {
  if (state.view === "map" && state.data?.map) {
    const rect = els.viewport.getBoundingClientRect();
    return [Math.max(1, rect.width), Math.max(1, rect.height)];
  }
  if (state.camera) return state.camera.size;
  return null;
}

function clampPan() {
  if (state.view === "map") return;
  const size = currentStageSize();
  if (!size) return;
  const rect = els.viewport.getBoundingClientRect();
  const imageWidth = size[0] * state.scale;
  const imageHeight = size[1] * state.scale;
  const minVisibleX = Math.min(MIN_VISIBLE_IMAGE_PX, rect.width / 2, imageWidth / 2);
  const minVisibleY = Math.min(MIN_VISIBLE_IMAGE_PX, rect.height / 2, imageHeight / 2);
  state.panX = Math.min(rect.width - minVisibleX, Math.max(minVisibleX - imageWidth, state.panX));
  state.panY = Math.min(rect.height - minVisibleY, Math.max(minVisibleY - imageHeight, state.panY));
}

function fitStage() {
  const size = currentStageSize();
  if (!size) return;
  if (state.view === "map") {
    fitMap();
    return;
  }
  if (state.camera) {
    fitCameraBetweenPanels();
    return;
  }
  const rect = els.viewport.getBoundingClientRect();
  const minScale = state.view === "map" ? Math.max(0.01, rect.width / size[0]) : minimumCameraScale();
  const scale = Math.max(minScale, Math.min(rect.width / size[0], rect.height / size[1]));
  state.scale = Math.max(0.05, scale);
  state.panX = (rect.width - size[0] * state.scale) / 2;
  state.panY = (rect.height - size[1] * state.scale) / 2;
  applyTransform();
}

function fitCamera() {
  fitCameraBetweenPanels();
}

function availableImageWidthBetweenPanels() {
  const viewportRect = els.viewport.getBoundingClientRect();
  const cameraPanelRect = els.cameraPanel.getBoundingClientRect();
  const landmarkPanelRect = els.landmarkPanel.getBoundingClientRect();
  const left = Math.max(0, cameraPanelRect.right - viewportRect.left);
  const right = Math.min(viewportRect.width, landmarkPanelRect.left - viewportRect.left);
  return Math.max(1, right - left);
}

function minimumCameraScale() {
  if (!state.camera) return;
  return Math.max(0.05, availableImageWidthBetweenPanels() / state.camera.size[0]);
}

function fitCameraBetweenPanels() {
  if (!state.camera) return;
  const viewportRect = els.viewport.getBoundingClientRect();
  const cameraPanelRect = els.cameraPanel.getBoundingClientRect();
  const landmarkPanelRect = els.landmarkPanel.getBoundingClientRect();
  const left = Math.max(0, cameraPanelRect.right - viewportRect.left);
  const right = Math.min(viewportRect.width, landmarkPanelRect.left - viewportRect.left);
  const width = Math.max(1, right - left);
  state.scale = Math.min(8, Math.max(minimumCameraScale(), width / state.camera.size[0]));
  state.panX = left + (width - state.camera.size[0] * state.scale) / 2;
  state.panY = (viewportRect.height - state.camera.size[1] * state.scale) / 2;
  applyTransform();
}

function mapViewSize() {
  const rect = els.viewport.getBoundingClientRect();
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  };
}

function mapView() {
  const size = mapViewSize();
  return {
    centerX: state.map.centerX,
    centerY: state.map.centerY,
    zoom: state.map.zoom,
    width: size.width,
    height: size.height,
  };
}

function mapPointToWorld(point) {
  const map = state.data?.map;
  if (!map || !point) return null;
  return {
    x: (point.x - map.zero[0]) / map.scale,
    y: (map.zero[1] - point.y) / map.scale,
  };
}

function entityWorldPoint(entity) {
  if (entity?.xyz) {
    return {
      x: entity.xyz[0],
      y: entity.xyz[1],
    };
  }
  if (entity?.map) return mapPointToWorld(entity.map);
  return null;
}

function worldToMapScreen(point) {
  if (!point) return null;
  return tileMap.worldToScreen(point.x, point.y, mapView());
}

function fitMap() {
  const size = mapViewSize();
  const metersPerPixel = Math.max(20000 / size.width, 20000 / size.height);
  state.map.zoom = Math.max(0, Math.min(6, tileMap.zoomForMetersPerPixel(metersPerPixel)));
  applyTransform();
  scheduleMapRender();
}

function applyTransform() {
  if (state.view === "map") {
    els.stage.style.transform = "translate(0, 0) scale(1)";
    resizePreviewCanvas();
    return;
  }
  clampPan();
  els.stage.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
  resizePreviewCanvas();
  redrawConePreview();
}

function resizePreviewCanvas() {
  const rect = els.viewport.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  els.previewCanvas.style.width = `${width}px`;
  els.previewCanvas.style.height = `${height}px`;
}

function clearPreview() {
  state.hoveredCone = null;
  previewRequest += 1;
  const context = els.previewCanvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
}

function clearStageGeometry() {
  els.stage.classList.remove("is-map");
  els.frame.style.width = "0px";
  els.frame.style.height = "0px";
  els.mapCanvas.width = 0;
  els.mapCanvas.height = 0;
  els.mapCanvas.style.width = "0px";
  els.mapCanvas.style.height = "0px";
  els.previewCanvas.width = 0;
  els.previewCanvas.height = 0;
  resizePreviewCanvas();
  els.guidesOverlay.setAttribute("width", 0);
  els.guidesOverlay.setAttribute("height", 0);
  els.guidesOverlay.setAttribute("viewBox", "0 0 0 0");
  els.overlay.setAttribute("width", 0);
  els.overlay.setAttribute("height", 0);
  els.overlay.setAttribute("viewBox", "0 0 0 0");
}

function getPreviewImage(src) {
  if (previewImages.has(src)) return previewImages.get(src);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
  previewImages.set(src, promise);
  return promise;
}

function affineFromTriangle(source, target) {
  const [[u0, v0], [u1, v1], [u2, v2]] = source;
  const [[x0, y0], [x1, y1], [x2, y2]] = target;
  const denominator = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
  if (Math.abs(denominator) < 1e-6) return null;
  return [
    (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / denominator,
    (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / denominator,
    (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / denominator,
    (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / denominator,
    (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / denominator,
    (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / denominator,
  ];
}

function drawTexturedTriangle(context, image, source, target) {
  const matrix = affineFromTriangle(source, target);
  if (!matrix) return;
  context.save();
  context.beginPath();
  context.moveTo(target[0][0], target[0][1]);
  context.lineTo(target[1][0], target[1][1]);
  context.lineTo(target[2][0], target[2][1]);
  context.closePath();
  context.clip();
  context.setTransform(...matrix);
  context.drawImage(image, 0, 0);
  context.restore();
}

function drawConePreview(image, quad) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const rect = els.viewport.getBoundingClientRect();
  const backingScale = Math.max(1, window.devicePixelRatio || 1);
  const backingWidth = Math.ceil(rect.width * backingScale);
  const backingHeight = Math.ceil(rect.height * backingScale);
  if (els.previewCanvas.width !== backingWidth) els.previewCanvas.width = backingWidth;
  if (els.previewCanvas.height !== backingHeight) els.previewCanvas.height = backingHeight;
  els.previewCanvas.style.width = `${Math.ceil(rect.width)}px`;
  els.previewCanvas.style.height = `${Math.ceil(rect.height)}px`;
  const context = els.previewCanvas.getContext("2d");
  const scaledQuad = quad.map((point) => [
    (state.panX + point[0] * state.scale) * backingScale,
    (state.panY + point[1] * state.scale) * backingScale,
  ]);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
  context.globalAlpha = 0.82;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = state.hoveredCone && shouldBlurCamera(cameraByName.get(state.hoveredCone.camera)) ? "grayscale(100%) blur(16px)" : "none";
  drawTexturedTriangle(context, image, [[0, 0], [width, 0], [width, height]], [scaledQuad[0], scaledQuad[1], scaledQuad[2]]);
  drawTexturedTriangle(context, image, [[0, 0], [width, height], [0, height]], [scaledQuad[0], scaledQuad[2], scaledQuad[3]]);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.filter = "none";
  context.globalAlpha = 1;
}

function showConePreview(cone) {
  const camera = cameraByName.get(cone.camera);
  const previewSource = camera?.frame || camera?.thumbnail;
  if (!previewSource || !cone.quad || cone.quad.length !== 4) return;
  state.hoveredCone = cone;
  const request = ++previewRequest;
  getPreviewImage(previewSource).then((image) => {
    if (request === previewRequest) drawConePreview(image, cone.quad);
  }).catch(() => {
    if (request === previewRequest) clearPreview();
  });
}

function redrawConePreview() {
  const cone = state.hoveredCone;
  if (!cone) return;
  const camera = cameraByName.get(cone.camera);
  const previewSource = camera?.frame || camera?.thumbnail;
  if (!previewSource || !cone.quad || cone.quad.length !== 4) return;
  const request = previewRequest;
  getPreviewImage(previewSource).then((image) => {
    if (request === previewRequest && state.hoveredCone === cone) drawConePreview(image, cone.quad);
  }).catch(() => {
    if (request === previewRequest) clearPreview();
  });
}

function renderGuides(layer) {
  const guides = state.data.uiOverlay?.guides?.[state.camera.name];
  if (guides) {
    for (const segment of guides.verticals || []) {
      layer.append(svg("line", {
        class: "vertical-guide",
        x1: segment[0][0],
        y1: segment[0][1],
        x2: segment[1][0],
        y2: segment[1][1],
      }));
    }
    if (guides.horizon) {
      const [horizonA, horizonB] = guides.horizon;
      const dx = horizonB[0] - horizonA[0];
      const dy = horizonB[1] - horizonA[1];
      const length = Math.hypot(dx, dy);
      if (length) {
        const horizonExtent = state.camera.size[0] * 1000;
        const ux = dx / length;
        const uy = dy / length;
        layer.append(svg("line", {
          class: "horizon-guide",
          x1: horizonA[0] - ux * horizonExtent,
          y1: horizonA[1] - uy * horizonExtent,
          x2: horizonB[0] + ux * horizonExtent,
          y2: horizonB[1] + uy * horizonExtent,
        }));
      }
    }
  }

  const player = state.data.uiOverlay?.players?.[state.camera.name];
  if (!player) return;
  for (const item of player.cross || []) {
    const segment = item.segment;
    layer.append(svg("line", {
      class: "player-cross",
      x1: segment[0][0],
      y1: segment[0][1],
      x2: segment[1][0],
      y2: segment[1][1],
      stroke: item.color,
    }));
  }
  for (const item of player.box || []) {
    const segment = item.segment;
    layer.append(svg("line", {
      class: "player-confidence-box",
      x1: segment[0][0],
      y1: segment[0][1],
      x2: segment[1][0],
      y2: segment[1][1],
      stroke: item.color,
    }));
  }
}

function addCameraConeSwitchHandler(element, onSwitch) {
  element.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const shouldToggle = event.metaKey || event.ctrlKey;
    let moved = false;
    const onMouseMove = (moveEvent) => {
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 4) moved = true;
    };
    const onMouseUp = (upEvent) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (upEvent.button !== 0 || moved) return;
      onSwitch(shouldToggle);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}

function renderCameraCones(layer) {
  const cones = state.data.uiOverlay?.cones?.[state.camera.name] || [];
  for (const cone of cones) {
    if (!isUserFacingCameraName(cone.camera)) continue;
    const coneCamera = cameraByName.get(cone.camera);
    const group = svg("g", { class: "camera-cone" });
    const title = svg("title");
    title.textContent = cone.camera;
    group.append(title);
    for (const [index, segment] of cone.segments.entries()) {
      group.append(svg("line", {
        class: "camera-cone-hit",
        x1: segment[0][0],
        y1: segment[0][1],
        x2: segment[1][0],
        y2: segment[1][1],
      }));
      group.append(svg("line", {
        class: `camera-cone-line${index === 0 ? " camera-cone-vertical" : ""}`,
        x1: segment[0][0],
        y1: segment[0][1],
        x2: segment[1][0],
        y2: segment[1][1],
        stroke: coneCamera?.color || "#999",
      }));
    }
    addCameraConeSwitchHandler(group, (shouldToggle) => {
      setFocus("cameras");
      selectCameraFromCone(cone.camera, shouldToggle);
    });
    group.addEventListener("mouseenter", () => showConePreview(cone));
    group.addEventListener("mouseleave", clearPreview);
    layer.append(group);
  }
}

function renderOverlay() {
  els.overlay.replaceChildren();
  els.guidesOverlay.replaceChildren();
  clearPreview();
  if (!state.camera) return;
  const guideLayer = svg("g", { class: "guide-layer" });
  const coneLayer = svg("g", { class: "camera-cone-layer" });
  const markerLayer = svg("g", { class: "marker-layer" });
  els.guidesOverlay.append(guideLayer);
  els.overlay.append(coneLayer, markerLayer);
  renderGuides(guideLayer);
  renderCameraCones(coneLayer);
  const observations = byCamera.get(state.camera.name) || [];
  for (const observation of observations) {
    const circle = svg("circle");
    const isSelected = observation.landmark === state.landmark;
    const isEditing = state.editMode && isSelected;
    circle.setAttribute("class", `marker${isSelected ? " selected" : ""}${isEditing ? " editing" : ""}`);
    circle.setAttribute("cx", observation.xy[0]);
    circle.setAttribute("cy", observation.xy[1]);
    circle.setAttribute("r", 8);
    circle.setAttribute("stroke", landmarkColor(observation.landmark));
    circle.dataset.landmark = observation.landmark;
    circle.addEventListener("mousedown", (event) => {
      event.stopPropagation();
      setFocus("landmarks");
      if (isEditing) {
        startObservationDrag(event, observation);
        return;
      }
      selectLandmark(observation.landmark, false, event.metaKey || event.ctrlKey);
    });
    const title = svg("title");
    title.textContent = observation.landmark;
    circle.append(title);
    markerLayer.append(circle);
  }
}

function renderMap() {
  if (pendingMapRender !== null) {
    cancelAnimationFrame(pendingMapRender);
    pendingMapRender = null;
  }
  if (!state.data.map) return;
  const { width, height } = mapViewSize();
  setStageSize(width, height, true);
  els.frame.removeAttribute("src");
  els.frame.hidden = false;
  if (els.mapCanvas.width !== width) els.mapCanvas.width = width;
  if (els.mapCanvas.height !== height) els.mapCanvas.height = height;
  const context = els.mapCanvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  tileMap.render(context, { ...mapView(), grayscale: true });
  els.guidesOverlay.replaceChildren();
  els.overlay.replaceChildren();
  clearPreview();
  if (DISABLE_MAP_SVG_OVERLAY) return;

  const rayLayer = svg("g", { class: "map-rays" });
  const coneLayer = svg("g", { class: "map-camera-cones" });
  const cameraLayer = svg("g", { class: "map-cameras" });
  const landmarkLayer = svg("g", { class: "map-landmarks" });
  els.overlay.append(rayLayer, coneLayer, cameraLayer, landmarkLayer);

  const rayObservations = [];
  if (state.camera) {
    for (const observation of byCamera.get(state.camera.name) || []) {
      if (landmarkByName.has(observation.landmark)) rayObservations.push(observation);
    }
  }
  if (state.landmark && landmarkByName.has(state.landmark)) {
    for (const observation of byLandmark.get(state.landmark) || []) {
      rayObservations.push(observation);
    }
  }
  const seenRays = new Set();
  for (const observation of rayObservations) {
    const key = `${observation.camera}\n${observation.landmark}`;
    if (seenRays.has(key)) continue;
    seenRays.add(key);
    const camera = cameraByName.get(observation.camera);
    const landmark = landmarkByName.get(observation.landmark);
    const cameraPoint = worldToMapScreen(entityWorldPoint(camera));
    const landmarkPoint = worldToMapScreen(entityWorldPoint(landmark));
    if (!cameraPoint || !landmarkPoint) continue;
    rayLayer.append(svg("line", {
      class: observation.camera === state.camera?.name && observation.landmark === state.landmark ? "map-ray selected" : "map-ray",
      x1: cameraPoint.x,
      y1: cameraPoint.y,
      x2: landmarkPoint.x,
      y2: landmarkPoint.y,
      stroke: landmarkColor(observation.landmark),
    }));
  }

  const cameras = state.landmark && state.settings.onlyShowCamerasForSelectedLandmark
    ? state.data.cameras.filter((camera) => cameraObservesLandmark(camera.name, state.landmark))
    : state.data.cameras;
  for (const camera of cameras) {
    const cameraPoint = worldToMapScreen(entityWorldPoint(camera));
    if (!cameraPoint) continue;
    const group = svg("g", { class: "map-camera" });
    for (const segment of camera.mapCone || []) {
      const start = worldToMapScreen(mapPointToWorld(segment[0]));
      const end = worldToMapScreen(mapPointToWorld(segment[1]));
      if (!start || !end) continue;
      group.append(svg("line", {
        class: "map-camera-cone-line",
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        stroke: camera.color,
      }));
    }
    const marker = svg("circle", {
      class: camera.name === state.camera?.name ? "map-camera-marker selected" : "map-camera-marker",
      cx: cameraPoint.x,
      cy: cameraPoint.y,
      r: 6,
      stroke: camera.color,
    });
    const title = svg("title");
    title.textContent = camera.name;
    marker.append(title);
    group.append(marker);
    group.addEventListener("mousedown", (event) => {
      event.stopPropagation();
      setFocus("map");
      selectCamera(camera.name, event.metaKey || event.ctrlKey, false);
    });
    coneLayer.append(group);
  }

  const visibleLandmarks = state.camera
    ? new Set((byCamera.get(state.camera.name) || []).map((observation) => observation.landmark))
    : null;
  for (const landmark of state.data.landmarks) {
    const landmarkPoint = worldToMapScreen(entityWorldPoint(landmark));
    if (!landmarkPoint) continue;
    if (visibleLandmarks && !visibleLandmarks.has(landmark.name) && landmark.name !== state.landmark) continue;
    const marker = svg("circle", {
      class: landmark.name === state.landmark ? "map-landmark-marker selected" : "map-landmark-marker",
      cx: landmarkPoint.x,
      cy: landmarkPoint.y,
      r: 6,
      fill: landmark.color,
    });
    const title = svg("title");
    title.textContent = landmark.name;
    marker.append(title);
    marker.addEventListener("mousedown", (event) => {
      event.stopPropagation();
      setFocus("map");
      selectLandmark(landmark.name, false, event.metaKey || event.ctrlKey);
    });
    landmarkLayer.append(marker);
  }
}

function scheduleMapRender() {
  if (state.view !== "map" || pendingMapRender !== null) return;
  pendingMapRender = requestAnimationFrame(() => {
    pendingMapRender = null;
    renderMap();
  });
}

function centerMapSelection(zoom = null) {
  if (state.view !== "map" || !state.data.map) return;
  let point = null;
  if (state.landmark) point = entityWorldPoint(landmarkByName.get(state.landmark));
  if (!point && state.camera) point = entityWorldPoint(state.camera);
  if (!point) return;
  if (zoom !== null) state.map.zoom = zoom;
  state.map.centerX = point.x;
  state.map.centerY = point.y;
  applyTransform();
  scheduleMapRender();
}

function centerMapOnCamera(camera, zoom = null) {
  if (state.view !== "map" || !camera) return;
  const point = entityWorldPoint(camera);
  if (!point) return;
  if (zoom !== null) state.map.zoom = zoom;
  state.map.centerX = point.x;
  state.map.centerY = point.y;
  applyTransform();
  scheduleMapRender();
}

function renderCurrentView(resetView = false) {
  if (state.view === "map") {
    renderMap();
    if (resetView) {
      if (state.camera || state.landmark) centerMapSelection(Math.max(state.map.zoom, MAP_FOCUS_ZOOM));
      else fitStage();
    }
  } else if (state.camera) {
    renderOverlay();
  }
  renderCameraPreview();
  updateEditTools();
}

function renderCameraPreview() {
  const camera = state.camera;
  const showMapPreview = state.view === "camera" && camera?.map && state.data.map;
  const showImagePreview = state.view === "map" && camera?.thumbnail;
  els.cameraPreview.hidden = !showMapPreview && !showImagePreview;
  els.cameraMapPreview.hidden = !showMapPreview;
  els.cameraImagePreview.hidden = !showImagePreview;
  els.cameraPreview.style.height = showImagePreview && camera?.size?.length === 2
    ? `${Math.round(256 * camera.size[1] / camera.size[0])}px`
    : "256px";
  if (showImagePreview) {
    els.cameraImagePreview.src = camera.thumbnail;
    els.cameraImagePreview.alt = camera.name;
    els.cameraImagePreview.classList.toggle("blurred-leak-preview", shouldBlurCamera(camera));
  } else {
    els.cameraImagePreview.removeAttribute("src");
    els.cameraImagePreview.alt = "";
    els.cameraImagePreview.classList.remove("blurred-leak-preview");
  }
  if (!showMapPreview) return;

  const request = ++state.panelPreviewRequest;
  if (request !== state.panelPreviewRequest) return;
  const point = entityWorldPoint(camera);
  if (!point) return;
  const cssSize = 256;
  const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  els.cameraMapPreview.width = Math.round(cssSize * ratio);
  els.cameraMapPreview.height = Math.round(cssSize * ratio);
  els.cameraMapPreview.style.width = `${cssSize}px`;
  els.cameraMapPreview.style.height = `${cssSize}px`;
  const context = els.cameraMapPreview.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const previewView = {
    centerX: point.x,
    centerY: point.y,
    zoom: tileMap.zoomForMetersPerPixel(1000 / cssSize),
    width: cssSize,
    height: cssSize,
    grayscale: true,
  };
  tileMap.render(context, previewView);
  context.filter = "none";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 1;
  for (const observation of byCamera.get(camera.name) || []) {
    const landmark = landmarkByName.get(observation.landmark);
    const landmarkPoint = entityWorldPoint(landmark);
    if (!landmarkPoint) continue;
    const target = tileMap.worldToScreen(landmarkPoint.x, landmarkPoint.y, previewView);
    if (!target) continue;
    context.strokeStyle = landmarkColor(observation.landmark);
    context.beginPath();
    context.moveTo(cssSize / 2, cssSize / 2);
    context.lineTo(target.x, target.y);
    context.stroke();
  }
  context.strokeStyle = camera.color || "#61c4ff";
  context.fillStyle = "white";
  context.lineWidth = 1.5;
  for (const segment of camera.mapCone || []) {
    const startWorld = mapPointToWorld(segment[0]);
    const endWorld = mapPointToWorld(segment[1]);
    const start = startWorld ? tileMap.worldToScreen(startWorld.x, startWorld.y, previewView) : null;
    const end = endWorld ? tileMap.worldToScreen(endWorld.x, endWorld.y, previewView) : null;
    if (!start || !end) continue;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  const center = tileMap.worldToScreen(point.x, point.y, previewView);
  context.lineWidth = 3;
  context.beginPath();
  context.arc(center.x, center.y, 6, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.setTransform(1, 0, 0, 1, 0, 0);
}

function viewportCenterImagePoint() {
  if (!state.camera) return null;
  const rect = els.viewport.getBoundingClientRect();
  const x = (rect.width / 2 - state.panX) / state.scale;
  const y = (rect.height / 2 - state.panY) / state.scale;
  return [
    Math.max(0, Math.min(state.camera.size[0], x)),
    Math.max(0, Math.min(state.camera.size[1], y)),
  ];
}

function eventImagePoint(event) {
  if (!state.camera) return null;
  const rect = els.viewport.getBoundingClientRect();
  const x = (event.clientX - rect.left - state.panX) / state.scale;
  const y = (event.clientY - rect.top - state.panY) / state.scale;
  return [
    Math.max(0, Math.min(state.camera.size[0], x)),
    Math.max(0, Math.min(state.camera.size[1], y)),
  ];
}

function offsetImagePoint(point, offset) {
  return [
    Math.max(0, Math.min(state.camera.size[0], point[0] - offset[0])),
    Math.max(0, Math.min(state.camera.size[1], point[1] - offset[1])),
  ];
}

async function postObservationEdit(payload) {
  const response = await fetch("http://127.0.0.1:8027/api/observations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Observation edit failed: ${response.status}`);
  }
  return data;
}

async function loadObservationEdits() {
  const response = await fetch("/data/observation_edits.json", { cache: "no-store" });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.edits) ? data.edits : [];
}

function ensureRawLandmarkRecord(name, color = null) {
  let landmark = state.data.landmarks.find((item) => item.name === name);
  if (landmark) {
    if (color) landmark.color = color;
    return landmark;
  }
  landmark = {
    name,
    order: state.data.landmarks.length,
    xyz: null,
    color: color || "#fff",
    observation_count: 0,
    map: null,
  };
  state.data.landmarks.push(landmark);
  return landmark;
}

function refreshImportedObservationCounts() {
  const cameraCounts = new Map();
  const landmarkCounts = new Map();
  for (const observation of state.data.observations) {
    cameraCounts.set(observation.camera, (cameraCounts.get(observation.camera) || 0) + 1);
    landmarkCounts.set(observation.landmark, (landmarkCounts.get(observation.landmark) || 0) + 1);
  }
  for (const camera of state.data.cameras) {
    camera.observation_count = cameraCounts.get(camera.name) || 0;
  }
  for (const landmark of state.data.landmarks) {
    landmark.observation_count = landmarkCounts.get(landmark.name) || 0;
  }
}

function replayObservationEdits(edits) {
  if (!edits.length) return;
  for (const edit of edits) {
    if (edit.action === "add") {
      if (!state.data.cameras.some((camera) => camera.name === edit.camera)) continue;
      if (state.data.observations.some((observation) => observation.camera === edit.camera && observation.landmark === edit.landmark)) continue;
      state.data.observations.push({
        camera: edit.camera,
        landmark: edit.landmark,
        xy: edit.xy,
        color: edit.color || "#fff",
      });
      ensureRawLandmarkRecord(edit.landmark, edit.color);
    } else if (edit.action === "edit") {
      const observation = state.data.observations.find((item) => item.camera === edit.camera && item.landmark === edit.landmark);
      if (!observation) continue;
      if (edit.xy) observation.xy = edit.xy;
      if (edit.name && edit.name !== edit.landmark) {
        observation.landmark = edit.name;
        observation.color = edit.color || observation.color;
        ensureRawLandmarkRecord(edit.name, edit.color || observation.color);
      }
    } else if (edit.action === "remove") {
      state.data.observations = state.data.observations.filter((observation) => {
        return !(observation.camera === edit.camera && observation.landmark === edit.landmark);
      });
    } else if (edit.action === "rename") {
      if (!edit.name || edit.name === edit.landmark) continue;
      for (const observation of state.data.observations) {
        if (observation.landmark === edit.landmark) {
          observation.landmark = edit.name;
          observation.color = edit.color || observation.color;
        }
      }
      const landmark = state.data.landmarks.find((item) => item.name === edit.landmark);
      if (landmark) {
        landmark.name = edit.name;
        landmark.color = edit.color || landmark.color;
      } else {
        ensureRawLandmarkRecord(edit.name, edit.color);
      }
    }
  }
  refreshImportedObservationCounts();
}

function ensureLandmarkRecord(name, color = null) {
  if (landmarkByName.has(name)) return landmarkByName.get(name);
  const landmark = {
    name,
    order: state.data.landmarks.length,
    xyz: null,
    color: color || "#fff",
    observation_count: 0,
    map: null,
  };
  state.data.landmarks.push(landmark);
  landmarkByName.set(name, landmark);
  return landmark;
}

function addObservationToState(edit, color) {
  const observation = {
    camera: edit.camera,
    landmark: edit.landmark,
    xy: edit.xy,
    color,
  };
  state.data.observations.push(observation);
  if (!byCamera.has(edit.camera)) byCamera.set(edit.camera, []);
  if (!byLandmark.has(edit.landmark)) byLandmark.set(edit.landmark, []);
  byCamera.get(edit.camera).push(observation);
  byLandmark.get(edit.landmark).push(observation);
  const landmark = ensureLandmarkRecord(edit.landmark, color);
  landmark.color = color || landmark.color;
  landmark.observation_count = byLandmark.get(edit.landmark).length;
  const camera = cameraByName.get(edit.camera);
  if (camera) camera.observation_count = byCamera.get(edit.camera).length;
}

function removeObservationFromState(edit) {
  state.data.observations = state.data.observations.filter((observation) => {
    return !(observation.camera === edit.camera && observation.landmark === edit.landmark);
  });
  if (byCamera.has(edit.camera)) {
    byCamera.set(edit.camera, byCamera.get(edit.camera).filter((observation) => observation.landmark !== edit.landmark));
  }
  if (byLandmark.has(edit.landmark)) {
    const observations = byLandmark.get(edit.landmark).filter((observation) => observation.camera !== edit.camera);
    if (observations.length) byLandmark.set(edit.landmark, observations);
    else byLandmark.delete(edit.landmark);
  }
  const landmark = landmarkByName.get(edit.landmark);
  if (landmark) landmark.observation_count = byLandmark.get(edit.landmark)?.length || 0;
  const camera = cameraByName.get(edit.camera);
  if (camera) camera.observation_count = byCamera.get(edit.camera)?.length || 0;
}

function updateObservationInState(edit) {
  const observation = (byCamera.get(edit.camera) || []).find((item) => item.landmark === edit.landmark);
  if (!observation) return;
  if (edit.xy) observation.xy = edit.xy;
}

function renameObservationInState(edit, color) {
  const oldName = edit.landmark;
  const newName = edit.name;
  if (!newName || newName === oldName) return;
  const observation = (byCamera.get(edit.camera) || []).find((item) => item.landmark === oldName);
  if (!observation) return;
  observation.landmark = newName;
  observation.color = color || observation.color;

  if (byLandmark.has(oldName)) {
    const oldObservations = byLandmark.get(oldName).filter((item) => item !== observation);
    if (oldObservations.length) byLandmark.set(oldName, oldObservations);
    else byLandmark.delete(oldName);
  }
  if (!byLandmark.has(newName)) byLandmark.set(newName, []);
  byLandmark.get(newName).push(observation);

  const oldRecord = landmarkByName.get(oldName);
  if (oldRecord) oldRecord.observation_count = byLandmark.get(oldName)?.length || 0;
  const newRecord = ensureLandmarkRecord(newName, color || observation.color);
  newRecord.color = color || newRecord.color;
  newRecord.observation_count = byLandmark.get(newName).length;
  state.landmark = newName;
}

function renameGlobalLandmarkInState(edit, color) {
  const oldName = edit.landmark;
  const newName = edit.name;
  if (!newName || newName === oldName) return;
  const observations = byLandmark.get(oldName) || [];
  byLandmark.delete(oldName);
  byLandmark.set(newName, observations);
  for (const observation of observations) {
    observation.landmark = newName;
    observation.color = color || observation.color;
  }
  const landmark = landmarkByName.get(oldName);
  if (landmark) {
    landmark.name = newName;
    landmark.color = color || landmark.color;
    landmark.observation_count = observations.length;
    landmarkByName.delete(oldName);
    landmarkByName.set(newName, landmark);
  } else {
    const newRecord = ensureLandmarkRecord(newName, color);
    newRecord.observation_count = observations.length;
  }
  state.landmark = newName;
}

function cancelObservationEditMode() {
  state.editMode = false;
  state.renameMode = false;
  state.editingObservation = null;
  document.body.classList.remove("is-editing-observation", "is-dragging-observation");
  renderLandmarkList();
  renderOverlay();
  updateEditTools();
}

async function commitLocalObservationName(value, finish = false) {
  if (!state.editMode || !state.camera || !state.landmark) return;
  const name = value.trim();
  const oldName = state.landmark;
  if (!name || name === oldName) {
    if (finish) cancelObservationEditMode();
    else renderLandmarkList();
    return;
  }
  try {
    const result = await postObservationEdit({
      action: "edit",
      camera: state.camera.name,
      landmark: oldName,
      name,
    });
    renameObservationInState(result.edit, result.color);
    renderCameraList();
    renderLandmarkList();
    renderOverlay();
    renderCameraPreview();
    updateGlobalStatus();
    writeHash(state.camera.name, result.edit.name);
    if (finish) cancelObservationEditMode();
  } catch (error) {
    console.error(error);
    els.title.textContent = error.message;
    renderLandmarkList();
  }
}

async function commitGlobalLandmarkName(value, finish = false) {
  if (!state.renameMode || state.camera || !state.landmark) return;
  const name = value.trim();
  const oldName = state.landmark;
  if (!name || name === oldName) {
    if (finish) cancelObservationEditMode();
    else renderLandmarkList();
    return;
  }
  try {
    const result = await postObservationEdit({
      action: "rename",
      landmark: oldName,
      name,
    });
    renameGlobalLandmarkInState(result.edit, result.color);
    renderCameraList();
    renderLandmarkList();
    renderMap();
    renderCameraPreview();
    updateGlobalStatus();
    writeHash(null, result.edit.name);
    if (finish) cancelObservationEditMode();
  } catch (error) {
    console.error(error);
    els.title.textContent = error.message;
    renderLandmarkList();
  }
}

function toggleObservationEditMode() {
  if (state.view !== "camera" || !state.camera || !state.landmark) return;
  state.renameMode = false;
  state.editMode = !state.editMode;
  state.editingObservation = null;
  document.body.classList.toggle("is-editing-observation", state.editMode);
  renderLandmarkList();
  renderOverlay();
  updateEditTools();
}

function toggleGlobalRenameMode() {
  if (!state.landmark || state.camera) return;
  state.editMode = false;
  state.renameMode = !state.renameMode;
  state.editingObservation = null;
  document.body.classList.toggle("is-editing-observation", state.renameMode);
  renderLandmarkList();
  updateEditTools();
}

function startObservationDrag(event, observation) {
  if (!state.editMode || !state.camera || observation.landmark !== state.landmark) return;
  event.preventDefault();
  const pointer = eventImagePoint(event) || observation.xy;
  state.editingObservation = {
    camera: observation.camera,
    landmark: observation.landmark,
    originalXY: [...observation.xy],
    pointerOffset: [pointer[0] - observation.xy[0], pointer[1] - observation.xy[1]],
    observation,
  };
  document.body.classList.add("is-dragging-observation");
}

async function addObservation() {
  if (state.view !== "camera" || !state.camera) return;
  const xy = viewportCenterImagePoint();
  if (!xy) return;
  const result = await postObservationEdit({
    action: "add",
    camera: state.camera.name,
    xy,
  });
  addObservationToState(result.edit, result.color);
  state.landmark = result.edit.landmark;
  state.editMode = true;
  state.renameMode = false;
  state.editingObservation = null;
  document.body.classList.add("is-editing-observation");
  writeHash(state.camera.name, result.edit.landmark);
  renderCameraList();
  renderLandmarkList();
  renderOverlay();
  renderCameraPreview();
  updateGlobalStatus();
}

async function removeObservation() {
  if (state.view !== "camera" || !state.camera || !state.landmark) return;
  cancelObservationEditMode();
  const landmark = state.landmark;
  const result = await postObservationEdit({
    action: "remove",
    camera: state.camera.name,
    landmark,
  });
  removeObservationFromState(result.edit);
  selectLandmark(null, false);
}

async function runObservationAction(action) {
  try {
    if (action === "add") await addObservation();
    else if (action === "remove") await removeObservation();
    else if (action === "edit") {
      toggleObservationEditMode();
    } else if (action === "rename") {
      toggleGlobalRenameMode();
    }
  } catch (error) {
    console.error(error);
    els.title.textContent = error.message;
  }
}

function focusObservation(landmarkName) {
  if (!state.camera) return;
  const observation = (byCamera.get(state.camera.name) || []).find((item) => item.landmark === landmarkName);
  if (!observation) return;
  const rect = els.viewport.getBoundingClientRect();
  state.panX = rect.width / 2 - observation.xy[0] * state.scale;
  state.panY = rect.height / 2 - observation.xy[1] * state.scale;
  applyTransform();
}

function hashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function writeHash(cameraName, landmarkName) {
  const params = new URLSearchParams();
  if (state.view === "map") params.set("view", "map");
  if (cameraName) params.set("camera", cameraName);
  if (landmarkName) params.set("landmark", landmarkName);
  const next = params.toString();
  const current = window.location.hash.replace(/^#/, "");
  if (!next) {
    if (current) {
      history.pushState(null, "", window.location.pathname + window.location.search);
      applyHash();
    }
  } else if (current !== next) {
    window.location.hash = next;
  }
}

function applyHash() {
  if (!state.data) return;
  const params = hashParams();
  const nextView = params.get("view") === "map" ? "map" : "camera";
  const cameraName = params.get("camera");
  const landmarkName = params.get("landmark");
  const previousCameraName = state.camera?.name || null;
  const previousView = state.view;
  state.view = nextView;
  els.viewSelect.value = state.view;
  const cameraChanged = previousCameraName !== cameraName;
  const hasPendingCameraFit = Boolean(state.pendingCameraFit);
  const preserveLandmarkView = Boolean(
    !hasPendingCameraFit && previousCameraName && cameraChanged && landmarkName && cameraObservesLandmark(cameraName, landmarkName)
  );
  if (cameraName) {
    applyCameraSelection(cameraName, cameraChanged && !preserveLandmarkView);
  } else if (state.view === "map") {
    state.camera = null;
    renderCameraList();
    renderLandmarkList();
    updateGlobalStatus();
  } else {
    clearCameraSelection();
  }
  if (landmarkName) {
    applyLandmarkSelection(landmarkName, state.pendingFocusLandmark || preserveLandmarkView);
  } else if (state.landmark) {
    applyLandmarkSelection(null, false);
  }
  if (state.view === "map") {
    renderCurrentView(previousView !== "map");
  }
  state.pendingFocusLandmark = false;
  state.pendingCameraFit = null;
  state.pendingMapFocus = true;
}

function cameraObservesLandmark(cameraName, landmarkName) {
  return (byCamera.get(cameraName) || []).some((observation) => observation.landmark === landmarkName);
}

function selectCamera(name, shouldToggle, focusMap = true) {
  if (shouldToggle && state.camera?.name === name) {
    writeHash(null, null);
    return;
  }
  state.pendingMapFocus = focusMap;
  const landmarkName = state.landmark && cameraObservesLandmark(name, state.landmark) ? state.landmark : null;
  writeHash(name, landmarkName);
}

function selectCameraFromCone(name, shouldToggle) {
  state.pendingCameraFit = "between-panels";
  selectCamera(name, shouldToggle, true);
}

function setView(view) {
  if (view !== "camera" && view !== "map") return;
  if (state.view === view) return;
  cancelObservationEditMode();
  const cameraName = state.camera?.name || null;
  const landmarkName = state.landmark || null;
  const focusCameraLandmark = view === "camera" && cameraName && landmarkName && cameraObservesLandmark(cameraName, landmarkName);
  const focusMapSelection = view === "map" && (cameraName || landmarkName);
  if (focusCameraLandmark) {
    state.pendingCameraFit = "between-panels";
    state.pendingFocusLandmark = true;
  }
  state.view = view;
  els.viewSelect.value = view;
  writeHash(cameraName, landmarkName);
  if (view === "camera" && state.camera) {
    applyCameraSelection(state.camera.name, true);
    if (focusCameraLandmark) applyLandmarkSelection(state.landmark, true);
  } else if (view === "map") {
    renderMap();
    if (focusMapSelection) centerMapSelection(Math.max(state.map.zoom, MAP_FOCUS_ZOOM));
    else fitStage();
    renderCameraPreview();
    updateEditTools();
  }
}

function clearLandmarkSelection() {
  cancelObservationEditMode();
  writeHash(state.camera?.name || null, null);
  if (window.location.hash.replace(/^#/, "") === hashParams().toString()) {
    applyLandmarkSelection(null, false);
    scrollSelectedIntoView(els.cameraList);
  }
}

function clearCameraSelection() {
  cancelObservationEditMode();
  state.camera = null;
  state.landmark = null;
  state.scale = 1;
  state.panX = 0;
  state.panY = 0;
  els.title.textContent = "";
  els.frame.removeAttribute("src");
  els.frame.hidden = true;
  clearPreview();
  els.guidesOverlay.replaceChildren();
  els.overlay.replaceChildren();
  clearStageGeometry();
  els.stage.style.width = "0px";
  els.stage.style.height = "0px";
  applyTransform();
  renderCameraList();
  renderLandmarkList();
  renderCameraPreview();
  updateGlobalStatus();
}

function applyCameraSelection(name, resetView = true) {
  const previousCameraName = state.camera?.name || null;
  state.camera = state.data.cameras.find((camera) => camera.name === name) || null;
  if (previousCameraName !== state.camera?.name && !cameraObservesLandmark(name, state.landmark)) {
    cancelObservationEditMode();
    state.landmark = null;
  }
  if (!state.camera) return;
  if (state.view === "camera") {
    setStageSize(state.camera.size[0], state.camera.size[1], false);
    els.frame.src = state.camera.frame || "";
    els.frame.hidden = !state.camera.frame;
    els.frame.classList.toggle("blurred-leak-frame", shouldBlurCamera(state.camera));
    if (resetView) {
      if (state.pendingCameraFit === "between-panels") {
        fitCameraBetweenPanels();
      } else {
        fitCamera();
      }
    }
    renderOverlay();
  } else {
    if (resetView && state.pendingMapFocus !== false) {
      centerMapSelection(Math.max(state.map.zoom, MAP_FOCUS_ZOOM));
    } else {
      scheduleMapRender();
    }
  }
  renderCameraList();
  renderLandmarkList();
  renderCameraPreview();
  updateGlobalStatus();
  scrollSelectedIntoView(els.cameraList);
}

function selectLandmark(name, focus, shouldToggle = false) {
  const next = shouldToggle && state.landmark === name ? null : name;
  state.pendingFocusLandmark = Boolean(focus && next);
  writeHash(state.camera?.name || null, next);
  if (window.location.hash.replace(/^#/, "") === hashParams().toString()) {
    applyLandmarkSelection(next, focus);
    state.pendingFocusLandmark = false;
  }
}

function applyLandmarkSelection(name, focus) {
  if (name && state.camera) {
    const hasObservation = (byCamera.get(state.camera.name) || []).some((observation) => observation.landmark === name);
    if (!hasObservation) return;
  }
  if (state.landmark !== name) cancelObservationEditMode();
  state.landmark = name;
  renderCameraList();
  renderLandmarkList();
  if (state.view === "map") {
    scheduleMapRender();
  } else {
    renderOverlay();
  }
  updateGlobalStatus();
  scrollSelectedIntoView(els.landmarkList);
  if (state.landmark && focus) {
    if (state.view === "map") centerMapSelection();
    else focusObservation(state.landmark);
  }
}

function scrollSelectedIntoView(list) {
  const selected = list.querySelector(".item.selected");
  if (selected) {
    selected.scrollIntoView({ block: "nearest" });
  }
}

function moveCameraSelection(delta) {
  const cameras = cameraRows();
  if (!cameras.length) return;
  const current = state.camera ? cameras.findIndex((camera) => camera.name === state.camera.name) : -1;
  const next = Math.min(cameras.length - 1, Math.max(0, current + delta));
  selectCamera(cameras[next].name);
}

function selectCameraEdge(index) {
  const cameras = cameraRows();
  if (!cameras.length) return;
  selectCamera(cameras[index].name);
}

function moveLandmarkSelection(delta) {
  const observations = landmarkRows();
  if (!observations.length) return;
  const current = state.landmark
    ? observations.findIndex((observation) => observation.landmark === state.landmark)
    : -1;
  const next = Math.min(observations.length - 1, Math.max(0, current + delta));
  selectLandmark(observations[next].landmark, true);
}

function selectLandmarkEdge(index) {
  const observations = landmarkRows();
  if (!observations.length) return;
  selectLandmark(observations[index].landmark, true);
}

function zoomAt(mouseX, mouseY, factor) {
  if (!currentStageSize()) return;
  const imageX = (mouseX - state.panX) / state.scale;
  const imageY = (mouseY - state.panY) / state.scale;
  if (state.view === "map") {
    const before = tileMap.screenToWorld(mouseX, mouseY, mapView());
    state.map.zoom = Math.min(6, Math.max(0, state.map.zoom + Math.log2(factor)));
    const after = tileMap.screenToWorld(mouseX, mouseY, mapView());
    state.map.centerX += before.x - after.x;
    state.map.centerY += before.y - after.y;
    scheduleMapRender();
    return;
  }
  const minScale = state.view === "map"
    ? Math.max(0.01, els.viewport.getBoundingClientRect().width / currentStageSize()[0])
    : minimumCameraScale();
  const nextScale = Math.min(state.view === "map" ? 20 : 8, Math.max(minScale, state.scale * factor));
  state.scale = nextScale;
  state.panX = mouseX - imageX * state.scale;
  state.panY = mouseY - imageY * state.scale;
  applyTransform();
}

function onWheel(event) {
  if (!currentStageSize()) return;
  event.preventDefault();
  const rect = els.viewport.getBoundingClientRect();
  zoomAt(
    event.clientX - rect.left,
    event.clientY - rect.top,
    Math.exp(-event.deltaY * 0.001),
  );
}

function installPan() {
  let drag = null;
  els.viewport.addEventListener("mousedown", (event) => {
    setFocus("map");
    if (!currentStageSize()) return;
    if (event.target.closest?.(".marker, .camera-cone, .map-camera, .map-landmark-marker")) return;
    state.dragging = true;
    document.body.classList.add("is-dragging");
    drag = {
      x: event.clientX,
      y: event.clientY,
      panX: state.panX,
      panY: state.panY,
      centerX: state.map.centerX,
      centerY: state.map.centerY,
    };
  });
  window.addEventListener("mousemove", (event) => {
    if (state.editingObservation) {
      const pointer = eventImagePoint(event);
      if (!pointer) return;
      state.editingObservation.observation.xy = offsetImagePoint(pointer, state.editingObservation.pointerOffset);
      renderOverlay();
      return;
    }
    if (!drag) return;
    if (state.view === "map") {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      const view = {
        ...mapView(),
        centerX: drag.centerX,
        centerY: drag.centerY,
      };
      const nextCenter = tileMap.screenToWorld(view.width / 2 - dx, view.height / 2 - dy, view);
      state.map.centerX = nextCenter.x;
      state.map.centerY = nextCenter.y;
      scheduleMapRender();
      return;
    }
    state.panX = drag.panX + event.clientX - drag.x;
    state.panY = drag.panY + event.clientY - drag.y;
    applyTransform();
  });
  window.addEventListener("mouseup", async (event) => {
    if (state.editingObservation) {
      const editing = state.editingObservation;
      state.editingObservation = null;
      document.body.classList.remove("is-dragging-observation");
      const pointer = eventImagePoint(event);
      const xy = pointer ? offsetImagePoint(pointer, editing.pointerOffset) : editing.observation.xy;
      editing.observation.xy = xy;
      renderOverlay();
      try {
        const result = await postObservationEdit({
          action: "edit",
          camera: editing.camera,
          landmark: editing.landmark,
          xy,
        });
        updateObservationInState(result.edit);
        renderOverlay();
      } catch (error) {
        editing.observation.xy = editing.originalXY;
        renderOverlay();
        console.error(error);
        els.title.textContent = error.message;
      }
      return;
    }
    drag = null;
    state.dragging = false;
    document.body.classList.remove("is-dragging");
  });
}

function focusFindField() {
  const input = state.focus === "landmarks" ? els.landmarkFind : state.focus === "cameras" ? els.cameraFind : null;
  if (!input) return false;
  input.focus();
  input.select();
  return true;
}

function clearFocusedFindField() {
  const input = state.focus === "landmarks" ? els.landmarkFind : state.focus === "cameras" ? els.cameraFind : null;
  if (!input || !input.value) return false;
  input.value = "";
  if (state.focus === "landmarks") renderLandmarkList();
  else renderCameraList();
  return true;
}

function cycleFocus(reverse = false) {
  const current = FOCUS_ORDER.includes(state.focus) ? FOCUS_ORDER.indexOf(state.focus) : 0;
  const delta = reverse ? -1 : 1;
  setFocus(FOCUS_ORDER[(current + delta + FOCUS_ORDER.length) % FOCUS_ORDER.length]);
}

function setMapZoom(zoom) {
  state.map.zoom = Math.min(6, Math.max(0, zoom));
  if (state.view === "map") {
    scheduleMapRender();
  }
}

function panCameraView(dx, dy) {
  if (state.view === "map") return;
  state.panX += dx;
  state.panY += dy;
  applyTransform();
}

function runKeyboardNavigation(timestamp) {
  if (keyboardNavigation.frame === null) return;
  const deltaFactor = keyboardNavigation.timestamp === null
    ? 1
    : Math.min((timestamp - keyboardNavigation.timestamp) / KEYBOARD_FRAME_MS, 2);
  keyboardNavigation.timestamp = timestamp;

  const rect = els.viewport.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const zoomStep = KEYBOARD_ZOOM_AMOUNT * deltaFactor;

  if (keyboardNavigation.keys.has("-")) {
    if (state.view === "map") setMapZoom(state.map.zoom - zoomStep);
    else zoomAt(centerX, centerY, Math.pow(2, -zoomStep));
  }
  if (keyboardNavigation.keys.has("=")) {
    if (state.view === "map") setMapZoom(state.map.zoom + zoomStep);
    else zoomAt(centerX, centerY, Math.pow(2, zoomStep));
  }

  if (state.focus === "map") {
    if (state.view === "map") {
      const panStep = tileMap.metersPerPixel(state.map.zoom) * rect.height * KEYBOARD_PAN_AMOUNT * deltaFactor;
      let x = state.map.centerX;
      let y = state.map.centerY;
      if (keyboardNavigation.keys.has("ArrowDown")) y -= panStep;
      if (keyboardNavigation.keys.has("ArrowLeft")) x -= panStep;
      if (keyboardNavigation.keys.has("ArrowRight")) x += panStep;
      if (keyboardNavigation.keys.has("ArrowUp")) y += panStep;
      if (x !== state.map.centerX || y !== state.map.centerY) {
        state.map.centerX = x;
        state.map.centerY = y;
        scheduleMapRender();
      }
    } else {
      const panStep = rect.height * KEYBOARD_PAN_AMOUNT * deltaFactor;
      let dx = 0;
      let dy = 0;
      if (keyboardNavigation.keys.has("ArrowDown")) dy -= panStep;
      if (keyboardNavigation.keys.has("ArrowLeft")) dx += panStep;
      if (keyboardNavigation.keys.has("ArrowRight")) dx -= panStep;
      if (keyboardNavigation.keys.has("ArrowUp")) dy += panStep;
      if (dx || dy) panCameraView(dx, dy);
    }
  }

  if (keyboardNavigation.keys.size) {
    keyboardNavigation.frame = requestAnimationFrame(runKeyboardNavigation);
  } else {
    keyboardNavigation.frame = null;
    keyboardNavigation.timestamp = null;
  }
}

function startKeyboardNavigation(key) {
  keyboardNavigation.keys.add(key);
  if (keyboardNavigation.frame !== null) return;
  keyboardNavigation.timestamp = null;
  keyboardNavigation.frame = requestAnimationFrame(runKeyboardNavigation);
}

function stopKeyboardNavigation(key) {
  keyboardNavigation.keys.delete(key);
  if (keyboardNavigation.keys.size || keyboardNavigation.frame === null) return;
  cancelAnimationFrame(keyboardNavigation.frame);
  keyboardNavigation.frame = null;
  keyboardNavigation.timestamp = null;
}

function stopAllKeyboardNavigation() {
  keyboardNavigation.keys.clear();
  if (keyboardNavigation.frame !== null) {
    cancelAnimationFrame(keyboardNavigation.frame);
    keyboardNavigation.frame = null;
  }
  keyboardNavigation.timestamp = null;
}

function wireControls() {
  els.settingsButton.addEventListener("click", openSettingsDialog);
  els.dialogClose.addEventListener("click", closeDialog);
  els.dialogBackdrop.addEventListener("mousedown", (event) => {
    if (event.target === els.dialogBackdrop) els.dialogBackdrop.classList.add("clicked");
  });
  els.dialogBackdrop.addEventListener("mouseup", () => {
    els.dialogBackdrop.classList.remove("clicked");
  });
  els.dialogBackdrop.addEventListener("mouseleave", () => {
    els.dialogBackdrop.classList.remove("clicked");
  });
  els.viewSelect.addEventListener("change", () => setView(els.viewSelect.value));
  els.cameraFind.addEventListener("input", renderCameraList);
  els.cameraFindClear.addEventListener("click", () => {
    els.cameraFind.value = "";
    renderCameraList();
    els.cameraFind.focus();
  });
  els.cameraSort.addEventListener("change", () => {
    localStorage.setItem(STORAGE.sortCameras, els.cameraSort.value);
    renderCameraList();
  });
  els.landmarkFind.addEventListener("input", renderLandmarkList);
  els.landmarkFindClear.addEventListener("click", () => {
    els.landmarkFind.value = "";
    renderLandmarkList();
    els.landmarkFind.focus();
  });
  els.landmarkSort.addEventListener("change", () => {
    localStorage.setItem(STORAGE.sortLandmarks, els.landmarkSort.value);
    renderLandmarkList();
  });
  els.cameraFind.addEventListener("focus", () => {
    setFocus("cameras");
  });
  els.cameraSort.addEventListener("focus", () => {
    setFocus("cameras");
  });
  els.landmarkFind.addEventListener("focus", () => {
    setFocus("landmarks");
  });
  els.landmarkSort.addEventListener("focus", () => {
    setFocus("landmarks");
  });
  els.cameraPanel.addEventListener("mousedown", () => {
    setFocus("cameras");
  });
  els.landmarkPanel.addEventListener("mousedown", () => {
    setFocus("landmarks");
  });
  els.addObservation.addEventListener("click", () => runObservationAction("add"));
  els.editObservation.addEventListener("click", () => runObservationAction("edit"));
  els.renameLandmark.addEventListener("click", () => runObservationAction("rename"));
  els.removeObservation.addEventListener("click", () => runObservationAction("remove"));
  els.viewport.addEventListener("wheel", onWheel, { passive: false });
  els.cameraPreview.addEventListener("click", () => {
    if (state.view === "camera") {
      const camera = state.camera;
      setView("map");
      centerMapOnCamera(camera, Math.max(state.map.zoom, MAP_FOCUS_ZOOM));
    }
    else if (state.camera) setView("camera");
  });
  window.addEventListener("resize", fitStage);
  window.addEventListener("hashchange", applyHash);
  window.addEventListener("keydown", (event) => {
    const activeElement = document.activeElement;
    if (activeElement?.matches?.("input, textarea, select, [contenteditable]")) return;
    const plainKey = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    const unmodifiedKey = !event.altKey && !event.ctrlKey && !event.metaKey;
    if (event.key === "Escape") {
      if (!els.dialogBackdrop.hidden) {
        event.preventDefault();
        closeDialog();
      } else if (state.editMode || state.renameMode) {
        event.preventDefault();
        cancelObservationEditMode();
      } else if (state.landmark) {
        event.preventDefault();
        clearLandmarkSelection();
      } else if (state.camera) {
        event.preventDefault();
        writeHash(null, null);
      }
      return;
    }
    if (!els.dialogBackdrop.hidden) return;
    if (event.key === "Tab") {
      event.preventDefault();
      cycleFocus(event.shiftKey);
      return;
    }
    if (event.key === "Enter" && (state.editMode || state.renameMode)) {
      event.preventDefault();
      cancelObservationEditMode();
      return;
    }
    if (plainKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      setView("camera");
      return;
    }
    if (plainKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      setView("map");
      return;
    }
    if (plainKey && event.key === ",") {
      event.preventDefault();
      openSettingsDialog();
      return;
    }
    if (unmodifiedKey && event.key.toLowerCase() === "f") {
      const handled = event.shiftKey ? clearFocusedFindField() : focusFindField();
      if (handled) event.preventDefault();
      return;
    }
    if (plainKey && "0123456".includes(event.key)) {
      event.preventDefault();
      setMapZoom(Number(event.key));
      return;
    }
    if (plainKey && ["-", "="].includes(event.key)) {
      event.preventDefault();
      startKeyboardNavigation(event.key);
      return;
    }
    if (plainKey && state.focus === "map" && ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      startKeyboardNavigation(event.key);
      return;
    }
    if (plainKey && ["ArrowLeft", "ArrowRight"].includes(event.key) && state.focus !== "map") {
      event.preventDefault();
      const index = event.key === "ArrowLeft" ? 0 : Number.POSITIVE_INFINITY;
      if (state.focus === "landmarks") {
        const observations = landmarkRows();
        selectLandmarkEdge(index === 0 ? 0 : observations.length - 1);
      } else {
        const cameras = cameraRows();
        selectCameraEdge(index === 0 ? 0 : cameras.length - 1);
      }
      return;
    }
    if (plainKey && event.key.toLowerCase() === "a" && !els.addObservation.hidden) {
      event.preventDefault();
      runObservationAction("add");
      return;
    }
    if (plainKey && event.key.toLowerCase() === "e" && !els.editObservation.hidden) {
      event.preventDefault();
      runObservationAction("edit");
      return;
    }
    if (plainKey && event.key.toLowerCase() === "r" && !els.renameLandmark.hidden) {
      event.preventDefault();
      runObservationAction("rename");
      return;
    }
    if (plainKey && event.key === "Delete" && !els.removeObservation.hidden) {
      event.preventDefault();
      runObservationAction("remove");
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    if (state.focus === "landmarks") {
      moveLandmarkSelection(delta);
    } else {
      moveCameraSelection(delta);
    }
  });
  window.addEventListener("keyup", (event) => {
    if (["-", "=", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event.key)) {
      stopKeyboardNavigation(event.key);
    }
  });
  window.addEventListener("blur", stopAllKeyboardNavigation);
  installPan();
}

function restorePreferences() {
  const legacyValues = {
    order: "ID",
    count: "observations",
  };
  const cameraSort = legacyValues[localStorage.getItem(STORAGE.sortCameras)] || localStorage.getItem(STORAGE.sortCameras);
  if (cameraSort && [...els.cameraSort.options].some((option) => option.value === cameraSort)) {
    els.cameraSort.value = cameraSort;
  }
  const landmarkSort = legacyValues[localStorage.getItem(STORAGE.sortLandmarks)] || localStorage.getItem(STORAGE.sortLandmarks);
  if (landmarkSort && [...els.landmarkSort.options].some((option) => option.value === landmarkSort)) {
    els.landmarkSort.value = landmarkSort;
  }
  state.settings.useMonospaceFont = storedBoolean(STORAGE.useMonospaceFont, false);
  state.settings.showCameraIDs = storedBoolean(STORAGE.showCameraIDs, false);
  state.settings.onlyShowCamerasForSelectedLandmark = storedBoolean(STORAGE.onlyShowCamerasForSelectedLandmark, false);
  state.settings.blurLeaks = storedBoolean(STORAGE.blurLeaks, false);
  applyGlobalSettings();
}

async function init() {
  const response = await fetch("/data/gtamapdata.json");
  if (!response.ok) throw new Error(`Could not load gtamapdata: ${response.status}`);
  state.data = await response.json();
  state.data.cameras = state.data.cameras.filter((camera) => isUserFacingCameraName(camera.name));
  const configResponse = await fetch("/data/config.json");
  state.data.config = configResponse.ok ? await configResponse.json() : {};
  replayObservationEdits(await loadObservationEdits());
  for (const observation of state.data.observations) {
    if (!byCamera.has(observation.camera)) byCamera.set(observation.camera, []);
    byCamera.get(observation.camera).push(observation);
    if (!byLandmark.has(observation.landmark)) byLandmark.set(observation.landmark, []);
    byLandmark.get(observation.landmark).push(observation);
  }
  const worldResponse = await fetch("/optimizer/result.json");
  if (worldResponse.ok) {
    applyWorldSnapshot(await worldResponse.json());
  }
  const overlayResponse = await fetch("/ui/data/overlay.json");
  state.data.uiOverlay = overlayResponse.ok ? await overlayResponse.json() : { guides: {}, cones: {} };
  for (const camera of state.data.cameras) {
    cameraByName.set(camera.name, camera);
  }
  for (const landmark of state.data.landmarks) {
    landmarkByName.set(landmark.name, landmark);
  }
  restorePreferences();
  wireControls();
  if (window.location.hash) {
    applyHash();
  } else {
    renderCameraList();
    renderLandmarkList();
    updateGlobalStatus();
  }
  updateEditTools();
}

init().catch((error) => {
  els.title.textContent = error.message;
  console.error(error);
});
