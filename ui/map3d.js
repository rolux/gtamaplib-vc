const MAP_W = 32768;
const MAP_H = 32768;
const ZERO_X = 16384;
const ZERO_Y = 16384;
const TILE_SIZE = 256;
const TILE_Z = 3;
const TILE_RANGE = [[0, 4], [19, 23]];
const TILE_ROOT = "/gtadb.org/maps/tiles/6/yanis,12";
const VC_DATA = "/data/gtamapdata.json";
const VC_RESULT = "/optimizer/result.json";
const GTAMAPLIB_COLORS = "/ui/data/map3d-colors.json";
const FOUR_SEASONS_WIREFRAME = "/ui/data/map3d-four-seasons.json";
const SUNSHINE_SKYWAY_WIREFRAME = "/ui/data/map3d-sunshine-skyway.json";
const HANKS_WAFFLES_WIREFRAME = "/ui/data/map3d-hanks-waffles.json";
const FAKE_CAMERA_SUFFIX = " Fake Cam";
const AIWE_CAMERA_NAME = "AI World Editor Map (4K)";
const YANIS_WATER_COLOR = [44 / 255, 103 / 255, 164 / 255, 1];
const CAMERA_CONE_DISTANCE = 100;
const CAMERA_THUMBNAIL_DISTANCE = CAMERA_CONE_DISTANCE * 0.995;
const TOUR_DWELL_MS = 1200;

const root = document.querySelector("#map3d-root");
const scene = document.querySelector("#map3d-scene");
const overlay = document.querySelector("#map3d-overlay");
const exitButton = document.querySelector("#map3d-exit");
const tourStartButton = document.querySelector("#map3d-tour-start");
const tourBackButton = document.querySelector("#map3d-tour-back");
const tourPauseButton = document.querySelector("#map3d-tour-pause");
const tourForwardButton = document.querySelector("#map3d-tour-forward");
const tourStopButton = document.querySelector("#map3d-tour-stop");
const viewDataEl = document.querySelector("#map3d-view-data");
const gl = scene.getContext("webgl", { antialias: true, alpha: false });
const ctx = overlay.getContext("2d");
let initialized = false;
let exitHandler = null;

const state = {
  width: 1,
  height: 1,
  target: [0, 0, 0],
  distance: 9800,
  yaw: -0.72,
  pitch: 0.92,
  vfov: 45,
  dragging: null,
  lastX: 0,
  lastY: 0,
  keys: new Set(),
  tiles: [],
  cameras: [],
  landmarks: [],
  wireframes: [],
  colors: new Map(),
  thumbnails: new Map(),
  blurLeaks: false,
  tour: {
    active: false,
    paused: false,
    index: 0,
    cameras: [],
    segment: null,
    elapsed: 0,
    holdUntil: 0,
    holdRemaining: 0,
    startedAt: 0,
    raf: null,
  },
};

if (!gl) {
  viewDataEl.textContent = "WebGL unavailable";
  throw new Error("WebGL unavailable");
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(vertex, fragment) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  return program;
}

const tileProgram = createProgram(`
attribute vec3 a_position;
attribute vec2 a_uv;
uniform mat4 u_matrix;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = u_matrix * vec4(a_position, 1.0);
}
`, `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_alpha;
uniform float u_blur;
uniform vec2 u_texel_size;
varying vec2 v_uv;
void main() {
  vec4 color = texture2D(u_texture, v_uv);
  if (u_blur > 0.5) {
    vec2 step = u_texel_size * 5.0;
    color = (
      texture2D(u_texture, v_uv) * 0.20 +
      texture2D(u_texture, v_uv + vec2(step.x, 0.0)) * 0.10 +
      texture2D(u_texture, v_uv - vec2(step.x, 0.0)) * 0.10 +
      texture2D(u_texture, v_uv + vec2(0.0, step.y)) * 0.10 +
      texture2D(u_texture, v_uv - vec2(0.0, step.y)) * 0.10 +
      texture2D(u_texture, v_uv + step) * 0.10 +
      texture2D(u_texture, v_uv - step) * 0.10 +
      texture2D(u_texture, v_uv + vec2(step.x, -step.y)) * 0.10 +
      texture2D(u_texture, v_uv + vec2(-step.x, step.y)) * 0.10
    );
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color = vec4(vec3(gray), color.a);
  }
  gl_FragColor = vec4(color.rgb, color.a * u_alpha);
}
`);

const colorProgram = createProgram(`
attribute vec3 a_position;
uniform mat4 u_matrix;
void main() {
  gl_Position = u_matrix * vec4(a_position, 1.0);
}
`, `
precision mediump float;
uniform vec4 u_color;
void main() {
  gl_FragColor = u_color;
}
`);

const tileBuffer = gl.createBuffer();
const lineBuffer = gl.createBuffer();
const solidBuffer = gl.createBuffer();
const tileLoc = {
  position: gl.getAttribLocation(tileProgram, "a_position"),
  uv: gl.getAttribLocation(tileProgram, "a_uv"),
  matrix: gl.getUniformLocation(tileProgram, "u_matrix"),
  texture: gl.getUniformLocation(tileProgram, "u_texture"),
  alpha: gl.getUniformLocation(tileProgram, "u_alpha"),
  blur: gl.getUniformLocation(tileProgram, "u_blur"),
  texelSize: gl.getUniformLocation(tileProgram, "u_texel_size"),
};
const colorLoc = {
  position: gl.getAttribLocation(colorProgram, "a_position"),
  matrix: gl.getUniformLocation(colorProgram, "u_matrix"),
  color: gl.getUniformLocation(colorProgram, "u_color"),
};

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerp3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function cubicBezier3(a, b, c, d, t) {
  const ab = lerp3(a, b, t);
  const bc = lerp3(b, c, t);
  const cd = lerp3(c, d, t);
  return lerp3(lerp3(ab, bc, t), lerp3(bc, cd, t), t);
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function lookAt(eye, target, up) {
  const z = normalize(subtract(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function transformPoint(matrix, point) {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w,
  ];
}

function worldToGl(x, y, z = 0) {
  return [x, z, -y];
}

function cameraEye() {
  const cp = Math.cos(state.pitch);
  return [
    state.target[0] + Math.sin(state.yaw) * cp * state.distance,
    state.target[1] + Math.sin(state.pitch) * state.distance,
    state.target[2] + Math.cos(state.yaw) * cp * state.distance,
  ];
}

function applyEyeTarget(eye, target) {
  const offset = subtract(eye, target);
  const distance = Math.max(1, Math.hypot(offset[0], offset[1], offset[2]));
  state.target = [...target];
  state.distance = distance;
  state.pitch = Math.asin(Math.max(-1, Math.min(1, offset[1] / distance)));
  state.yaw = Math.atan2(offset[0], offset[2]);
}

function currentView() {
  return {
    eye: cameraEye(),
    target: [...state.target],
    vfov: state.vfov,
  };
}

function viewYpr() {
  const eye = cameraEye();
  const direction = [
    state.target[0] - eye[0],
    -state.target[2] + eye[2],
    state.target[1] - eye[1],
  ];
  const yaw = ((Math.atan2(-direction[0], direction[1]) * 180 / Math.PI) + 360) % 360;
  const horizontal = Math.hypot(direction[0], direction[1]);
  const pitch = Math.atan2(direction[2], horizontal) * 180 / Math.PI;
  return [yaw, pitch, 0];
}

function formatTuple(values) {
  return `(${values.map((value) => Number(value).toFixed(3)).join(", ")})`;
}

function updateViewData() {
  const eye = cameraEye();
  const xyz = [eye[0], -eye[2], eye[1]];
  const ypr = viewYpr();
  const vfov = state.vfov;
  const hfov = 2 * Math.atan(Math.tan((vfov * Math.PI / 180) / 2) * (state.width / state.height)) * 180 / Math.PI;
  viewDataEl.textContent = `XYZ ${formatTuple(xyz)}  YPR ${formatTuple(ypr)}  FOV ${formatTuple([hfov, vfov])}`;
}

function viewProjection() {
  const projection = perspective(state.vfov * Math.PI / 180, state.width / state.height, 1, 90000);
  const view = lookAt(cameraEye(), state.target, [0, 1, 0]);
  return mat4Multiply(projection, view);
}

function colorForName(name) {
  return state.colors.get(name) || [1, 1, 1];
}

function createTexture(image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return texture;
}

function tileUrl(z, x, y) {
  return `${TILE_ROOT}/${z}/${z},${y},${x}.jpg`;
}

function tileWorldBounds(z, x, y) {
  const tilesPerSide = 4 * Math.pow(2, z);
  const tileMeters = MAP_W / tilesPerSide;
  const west = x * tileMeters - ZERO_X;
  const east = west + tileMeters;
  const north = ZERO_Y - y * tileMeters;
  const south = north - tileMeters;
  return { west, east, north, south };
}

function loadTile(z, x, y) {
  const image = new Image();
  const tile = { z, x, y, texture: null, loaded: false };
  image.onload = () => {
    tile.texture = createTexture(image);
    tile.loaded = true;
    requestAnimationFrame(render);
  };
  image.src = tileUrl(z, x, y);
  return tile;
}

function loadTiles() {
  const [[x0, y0], [x1, y1]] = TILE_RANGE;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      state.tiles.push(loadTile(TILE_Z, x, y));
    }
  }
}

function drawTile(tile, matrix) {
  if (!tile.loaded) return;
  const { west, east, north, south } = tileWorldBounds(tile.z, tile.x, tile.y);
  const z = -0.05;
  const vertices = new Float32Array([
    west, z, -north, 0, 1,
    east, z, -north, 1, 1,
    east, z, -south, 1, 0,
    west, z, -north, 0, 1,
    east, z, -south, 1, 0,
    west, z, -south, 0, 0,
  ]);
  drawTexturedVertices(vertices, tile.texture, matrix, { alpha: 1, texelSize: [1 / TILE_SIZE, 1 / TILE_SIZE] });
}

function drawTexturedVertices(vertices, texture, matrix, options = {}) {
  const alpha = options.alpha ?? 1;
  const blur = options.blur ? 1 : 0;
  const texelSize = options.texelSize || [1 / TILE_SIZE, 1 / TILE_SIZE];
  gl.useProgram(tileProgram);
  gl.uniformMatrix4fv(tileLoc.matrix, false, matrix);
  gl.uniform1f(tileLoc.alpha, alpha);
  gl.uniform1f(tileLoc.blur, blur);
  gl.uniform2f(tileLoc.texelSize, texelSize[0], texelSize[1]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(tileLoc.texture, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
  gl.enableVertexAttribArray(tileLoc.position);
  gl.vertexAttribPointer(tileLoc.position, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(tileLoc.uv);
  gl.vertexAttribPointer(tileLoc.uv, 2, gl.FLOAT, false, 20, 12);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function thumbnailTexture(camera) {
  if (!camera.thumbnail) return null;
  const url = `/${camera.thumbnail}`;
  if (state.thumbnails.has(url)) return state.thumbnails.get(url);
  const record = { loaded: false, texture: null, width: 1, height: 1 };
  state.thumbnails.set(url, record);
  const image = new Image();
  image.onload = () => {
    record.texture = createTexture(image);
    record.width = image.naturalWidth || image.width || 1;
    record.height = image.naturalHeight || image.height || 1;
    record.loaded = true;
    requestAnimationFrame(render);
  };
  image.src = url;
  return record;
}

function drawLines(points, color, matrix) {
  if (!points.length) return;
  gl.useProgram(colorProgram);
  gl.uniformMatrix4fv(colorLoc.matrix, false, matrix);
  gl.uniform4f(colorLoc.color, color[0], color[1], color[2], color[3]);
  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STREAM_DRAW);
  gl.enableVertexAttribArray(colorLoc.position);
  gl.vertexAttribPointer(colorLoc.position, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.LINES, 0, points.length / 3);
}

function drawSolidTriangles(points, color, matrix) {
  if (!points.length) return;
  gl.useProgram(colorProgram);
  gl.uniformMatrix4fv(colorLoc.matrix, false, matrix);
  gl.uniform4f(colorLoc.color, color[0], color[1], color[2], color[3]);
  gl.bindBuffer(gl.ARRAY_BUFFER, solidBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STREAM_DRAW);
  gl.enableVertexAttribArray(colorLoc.position);
  gl.vertexAttribPointer(colorLoc.position, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, points.length / 3);
}

function drawWaterPlane(matrix) {
  const extent = 250000;
  const z = -10;
  drawSolidTriangles([
    -extent, z, -extent,
    extent, z, -extent,
    extent, z, extent,
    -extent, z, -extent,
    extent, z, extent,
    -extent, z, extent,
  ], YANIS_WATER_COLOR, matrix);
}

function thickenLines(points, offsets = [0, 0.18]) {
  if (!points.length) return points;
  const thick = [];
  for (const offset of offsets) {
    for (let index = 0; index < points.length; index += 3) {
      thick.push(points[index], points[index + 1] + offset, points[index + 2]);
    }
  }
  return thick;
}

function directionFromYpr(ypr, u, v) {
  const yaw = (ypr[0] || 0) * Math.PI / 180;
  const pitch = (ypr[1] || 0) * Math.PI / 180;
  const roll = (ypr[2] || 0) * Math.PI / 180;
  let right = [Math.cos(yaw), Math.sin(yaw), 0];
  let forward = [-Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];
  let up = normalize(cross(right, forward));
  if (roll) {
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const nextRight = [
      right[0] * cr - up[0] * sr,
      right[1] * cr - up[1] * sr,
      right[2] * cr - up[2] * sr,
    ];
    const nextUp = [
      right[0] * sr + up[0] * cr,
      right[1] * sr + up[1] * cr,
      right[2] * sr + up[2] * cr,
    ];
    right = nextRight;
    up = nextUp;
  }
  return normalize([
    forward[0] + right[0] * u + up[0] * v,
    forward[1] + right[1] * u + up[1] * v,
    forward[2] + right[2] * u + up[2] * v,
  ]);
}

function cameraForwardGl(camera) {
  const d = directionFromYpr(camera.ypr, 0, 0);
  return normalize([d[0], d[2], -d[1]]);
}

function viewForCamera(camera) {
  const eye = worldToGl(camera.xyz[0], camera.xyz[1], camera.xyz[2]);
  const forward = cameraForwardGl(camera);
  const distance = 1200;
  return {
    eye,
    target: add(eye, scale(forward, distance)),
    vfov: camera.fov[1] || 45,
  };
}

function idSortKey(camera) {
  const id = String(camera.id || "");
  const match = id.match(/^([A-Za-z]+)(\d+)(?:\/(\d+))?/);
  if (!match) return [Number.POSITIVE_INFINITY, 99, Number.POSITIVE_INFINITY, camera.name];
  const letterOrder = { L: 0, T: 1, S: 2 };
  return [
    Number(match[2]),
    letterOrder[match[1][0].toUpperCase()] ?? 50,
    Number(match[3] || 0),
    camera.name,
  ];
}

function compareCameraIds(a, b) {
  const ak = idSortKey(a);
  const bk = idSortKey(b);
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] < bk[i]) return -1;
    if (ak[i] > bk[i]) return 1;
  }
  return 0;
}

function makeTourSegment(from, to) {
  const fromDirection = normalize(subtract(from.target, from.eye));
  const toDirection = normalize(subtract(to.target, to.eye));
  const span = Math.hypot(to.eye[0] - from.eye[0], to.eye[1] - from.eye[1], to.eye[2] - from.eye[2]);
  const handle = Math.max(350, Math.min(2600, span * 0.35));
  return {
    from,
    to,
    eyeC1: add(from.eye, scale(fromDirection, handle)),
    eyeC2: subtract(to.eye, scale(toDirection, handle)),
    targetC1: add(from.target, scale(fromDirection, handle)),
    targetC2: subtract(to.target, scale(toDirection, handle)),
    duration: Math.max(2600, Math.min(7000, span * 0.32)),
  };
}

function updateTourButton() {
  tourStartButton.hidden = state.tour.active;
  tourBackButton.hidden = !state.tour.active;
  tourPauseButton.hidden = !state.tour.active;
  tourForwardButton.hidden = !state.tour.active;
  tourStopButton.hidden = !state.tour.active;
  tourPauseButton.textContent = state.tour.paused ? "Resume" : "Pause";
}

function isDisplayCamera(camera) {
  return camera.xyz && !camera.name.endsWith(FAKE_CAMERA_SUFFIX) && camera.name !== AIWE_CAMERA_NAME;
}

function stopTourFrame() {
  if (state.tour.raf) {
    cancelAnimationFrame(state.tour.raf);
    state.tour.raf = null;
  }
}

function startTourSegment(from, camera) {
  const to = viewForCamera(camera);
  state.tour.segment = makeTourSegment(from, to);
  state.tour.elapsed = 0;
  state.tour.holdUntil = 0;
  state.tour.holdRemaining = 0;
  state.tour.startedAt = performance.now();
}

function applyTourView(view) {
  applyEyeTarget(view.eye, view.target);
  state.vfov = view.vfov || 45;
  render();
}

function ensureTourCameras() {
  state.tour.cameras = state.cameras
    .filter((camera) => camera.xyz && camera.ypr && camera.fov)
    .sort(compareCameraIds);
  return state.tour.cameras.length > 0;
}

function jumpTourTo(index, paused = state.tour.paused) {
  if (!ensureTourCameras()) return;
  stopTourFrame();
  const count = state.tour.cameras.length;
  state.tour.index = (index + count) % count;
  const view = viewForCamera(state.tour.cameras[state.tour.index]);
  state.tour.active = true;
  state.tour.paused = paused;
  state.tour.segment = makeTourSegment(view, view);
  state.tour.elapsed = 0;
  state.tour.holdRemaining = paused ? TOUR_DWELL_MS : 0;
  state.tour.holdUntil = paused ? 0 : performance.now() + TOUR_DWELL_MS;
  state.tour.startedAt = performance.now();
  applyTourView(view);
  updateTourButton();
  if (!paused) state.tour.raf = requestAnimationFrame(animateTour);
}

function isTourHolding() {
  return Boolean(state.tour.holdUntil || state.tour.holdRemaining);
}

function animateTour(now) {
  if (!state.tour.active || state.tour.paused || !state.tour.segment) return;
  if (state.tour.holdUntil) {
    if (now < state.tour.holdUntil) {
      state.tour.raf = requestAnimationFrame(animateTour);
      return;
    }
    const segment = state.tour.segment;
    state.tour.index = (state.tour.index + 1) % state.tour.cameras.length;
    startTourSegment(segment.to, state.tour.cameras[state.tour.index]);
  }
  const segment = state.tour.segment;
  state.tour.elapsed = now - state.tour.startedAt;
  const t = Math.min(1, state.tour.elapsed / segment.duration);
  const eased = smoothStep(t);
  const eye = cubicBezier3(segment.from.eye, segment.eyeC1, segment.eyeC2, segment.to.eye, eased);
  const target = cubicBezier3(segment.from.target, segment.targetC1, segment.targetC2, segment.to.target, eased);
  applyEyeTarget(eye, target);
  state.vfov = lerp(segment.from.vfov || 45, segment.to.vfov || 45, eased);
  render();
  if (t >= 1) {
    state.tour.holdUntil = now + TOUR_DWELL_MS;
  }
  state.tour.raf = requestAnimationFrame(animateTour);
}

function startTour() {
  if (!ensureTourCameras()) return;
  state.tour.active = true;
  state.tour.paused = false;
  if (!state.tour.segment) {
    state.tour.index = 0;
    startTourSegment(currentView(), state.tour.cameras[state.tour.index]);
  } else if (state.tour.holdRemaining) {
    state.tour.holdUntil = performance.now() + state.tour.holdRemaining;
    state.tour.holdRemaining = 0;
  } else {
    state.tour.startedAt = performance.now() - state.tour.elapsed;
  }
  updateTourButton();
  stopTourFrame();
  state.tour.raf = requestAnimationFrame(animateTour);
}

function pauseTour() {
  if (!state.tour.active) return;
  state.tour.holdRemaining = state.tour.holdUntil ? Math.max(0, state.tour.holdUntil - performance.now()) : 0;
  state.tour.paused = true;
  stopTourFrame();
  updateTourButton();
}

function toggleTour() {
  if (state.tour.active && !state.tour.paused) {
    pauseTour();
  } else {
    startTour();
  }
}

function stopTour() {
  stopTourFrame();
  state.tour.active = false;
  state.tour.paused = false;
  state.tour.index = 0;
  state.tour.segment = null;
  state.tour.elapsed = 0;
  state.tour.holdUntil = 0;
  state.tour.holdRemaining = 0;
  updateTourButton();
}

function forwardTour() {
  if (!state.tour.active) return;
  jumpTourTo(state.tour.index + (isTourHolding() ? 1 : 0));
}

function backTour() {
  if (!state.tour.active) return;
  jumpTourTo(state.tour.index - 1);
}

function cameraConeLines(camera) {
  if (!camera.xyz || !camera.ypr || !camera.fov) return [];
  const origin = worldToGl(camera.xyz[0], camera.xyz[1], camera.xyz[2]);
  const ground = worldToGl(camera.xyz[0], camera.xyz[1], 0);
  const hf = Math.tan((camera.fov[0] || 50) * Math.PI / 360);
  const vf = Math.tan((camera.fov[1] || 35) * Math.PI / 360);
  const distance = CAMERA_CONE_DISTANCE;
  const corners = [[-hf, -vf], [hf, -vf], [hf, vf], [-hf, vf]].map(([u, v]) => {
    const d = directionFromYpr(camera.ypr, u, v);
    return worldToGl(
      camera.xyz[0] + d[0] * distance,
      camera.xyz[1] + d[1] * distance,
      camera.xyz[2] + d[2] * distance,
    );
  });
  const lines = [
    ...origin, ...ground,
  ];
  for (const corner of corners) lines.push(...origin, ...corner);
  for (let i = 0; i < corners.length; i++) lines.push(...corners[i], ...corners[(i + 1) % corners.length]);
  return lines;
}

function cameraThumbnailVertices(camera) {
  if (!camera.xyz || !camera.ypr || !camera.fov) return null;
  const hf = Math.tan((camera.fov[0] || 50) * Math.PI / 360);
  const vf = Math.tan((camera.fov[1] || 35) * Math.PI / 360);
  const corners = [[-hf, vf], [hf, vf], [hf, -vf], [-hf, -vf]].map(([u, v]) => {
    const d = directionFromYpr(camera.ypr, u, v);
    return worldToGl(
      camera.xyz[0] + d[0] * CAMERA_THUMBNAIL_DISTANCE,
      camera.xyz[1] + d[1] * CAMERA_THUMBNAIL_DISTANCE,
      camera.xyz[2] + d[2] * CAMERA_THUMBNAIL_DISTANCE,
    );
  });
  return new Float32Array([
    ...corners[0], 0, 1,
    ...corners[1], 1, 1,
    ...corners[2], 1, 0,
    ...corners[0], 0, 1,
    ...corners[2], 1, 0,
    ...corners[3], 0, 0,
  ]);
}

function drawCameraThumbnail(camera, matrix) {
  const thumbnail = thumbnailTexture(camera);
  if (!thumbnail?.loaded) return;
  const vertices = cameraThumbnailVertices(camera);
  if (!vertices) return;
  drawTexturedVertices(vertices, thumbnail.texture, matrix, {
    alpha: 0.78,
    blur: shouldBlurCameraThumbnail(camera),
    texelSize: [1 / thumbnail.width, 1 / thumbnail.height],
  });
}

function shouldBlurCameraThumbnail(camera) {
  return Boolean(state.blurLeaks && camera?.id?.startsWith("L"));
}

function landmarkDropLine(landmark) {
  if (!landmark.xyz || Math.abs(landmark.xyz[2]) < 1e-6) return [];
  return [
    ...worldToGl(landmark.xyz[0], landmark.xyz[1], landmark.xyz[2]),
    ...worldToGl(landmark.xyz[0], landmark.xyz[1], 0),
  ];
}

function wireframeLines(wireframe) {
  const groups = { thin: [], bold: [] };
  for (const segment of wireframe.segments || []) {
    const points = Array.isArray(segment) ? segment : segment.points;
    const style = Array.isArray(segment) ? "thin" : segment.style || "thin";
    if (!points || points.length !== 2) continue;
    const target = style === "bold" ? groups.bold : groups.thin;
    target.push(...worldToGl(points[0][0], points[0][1], points[0][2]));
    target.push(...worldToGl(points[1][0], points[1][1], points[1][2]));
  }
  return groups;
}

function drawOverlay(matrix) {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.save();
  ctx.font = "11px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
  ctx.textBaseline = "middle";

  const markerRows = [];
  for (const landmark of state.landmarks) {
    if (!landmark.xyz) continue;
    const p = transformPoint(matrix, worldToGl(landmark.xyz[0], landmark.xyz[1], landmark.xyz[2]));
    if (p[2] < -1 || p[2] > 1) continue;
    const x = (p[0] * 0.5 + 0.5) * state.width;
    const y = (-p[1] * 0.5 + 0.5) * state.height;
    if (x < -24 || x > state.width + 24 || y < -24 || y > state.height + 24) continue;
    markerRows.push({ name: landmark.name, x, y, depth: p[2], color: colorForName(landmark.name), camera: false });
  }
  for (const camera of state.cameras) {
    if (!camera.xyz) continue;
    const p = transformPoint(matrix, worldToGl(camera.xyz[0], camera.xyz[1], camera.xyz[2]));
    if (p[2] < -1 || p[2] > 1) continue;
    const x = (p[0] * 0.5 + 0.5) * state.width;
    const y = (-p[1] * 0.5 + 0.5) * state.height;
    markerRows.push({ name: camera.name, x, y, depth: p[2], color: colorForName(camera.name), camera: true });
  }
  markerRows.sort((a, b) => b.depth - a.depth);
  for (const row of markerRows) {
    const r = row.camera ? 5 : 3.5;
    ctx.beginPath();
    ctx.arc(row.x, row.y, r, 0, Math.PI * 2);
    ctx.fillStyle = row.camera ? "rgba(255,255,255,0.92)" : `rgba(${row.color.map((v) => Math.round(v * 255)).join(",")},0.92)`;
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = row.camera ? `rgb(${row.color.map((v) => Math.round(v * 255)).join(",")})` : "rgba(255,255,255,0.85)";
    ctx.stroke();
  }
  ctx.restore();
}

function render() {
  resize();
  gl.viewport(0, 0, state.width, state.height);
  gl.clearColor(0.83, 0.81, 0.75, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.lineWidth(1);
  const matrix = viewProjection();
  gl.disable(gl.DEPTH_TEST);
  drawWaterPlane(matrix);
  gl.enable(gl.DEPTH_TEST);
  for (const tile of state.tiles) drawTile(tile, matrix);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  for (const camera of state.cameras) drawCameraThumbnail(camera, matrix);
  const lineGroups = [];
  for (const landmark of state.landmarks) {
    const line = landmarkDropLine(landmark);
    if (line.length) {
      const offsets = landmark.name === "WDNA FM" ? [0, 0.16, -0.16, 0.32] : [0, 0.16];
      lineGroups.push([thickenLines(line, offsets), [...colorForName(landmark.name), 0.34]]);
    }
  }
  for (const camera of state.cameras) {
    const lines = cameraConeLines(camera);
    if (lines.length) lineGroups.push([lines, [...colorForName(camera.name), 0.72]]);
  }
  for (const wireframe of state.wireframes) {
    const groups = wireframeLines(wireframe);
    const color = wireframe.color || [1.0, 0.92, 0.34];
    if (groups.thin.length) lineGroups.push([thickenLines(groups.thin, [0, 0.18, -0.18, 0.36]), [...color, 0.78]]);
    if (groups.bold.length) lineGroups.push([thickenLines(groups.bold, [0, 0.18, -0.18, 0.36, -0.36, 0.54]), [...color, 0.92]]);
  }
  for (const [lines, color] of lineGroups) drawLines(lines, color, matrix);
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  drawOverlay(matrix);
  const loaded = state.tiles.filter((tile) => tile.loaded).length;
  updateViewData();
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.floor(window.innerWidth * dpr));
  const height = Math.max(1, Math.floor(window.innerHeight * dpr));
  if (scene.width !== width || scene.height !== height) {
    scene.width = width;
    scene.height = height;
    overlay.width = width;
    overlay.height = height;
    state.width = width;
    state.height = height;
  }
}

function panBy(dx, dz) {
  const right = [Math.cos(state.yaw), 0, -Math.sin(state.yaw)];
  const forward = [Math.sin(state.yaw), 0, Math.cos(state.yaw)];
  state.target[0] += right[0] * dx + forward[0] * dz;
  state.target[2] += right[2] * dx + forward[2] * dz;
}

function resetView() {
  state.target = [0, 0, 0];
  state.distance = 9800;
  state.yaw = -0.72;
  state.pitch = 0.92;
  state.vfov = 45;
  render();
}

function zoomBy(factor) {
  state.distance = Math.max(700, Math.min(50000, state.distance * factor));
  render();
}

function groundPointUnderClient(clientX, clientY) {
  const rect = scene.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
  const eye = cameraEye();
  const forward = normalize(subtract(state.target, eye));
  let right = cross(forward, [0, 1, 0]);
  if (Math.hypot(right[0], right[1], right[2]) < 1e-6) return null;
  right = normalize(right);
  const up = normalize(cross(right, forward));
  const vf = Math.tan((state.vfov * Math.PI / 180) / 2);
  const hf = vf * (state.width / state.height);
  const direction = normalize(add(add(forward, scale(right, ndcX * hf)), scale(up, ndcY * vf)));
  if (Math.abs(direction[1]) < 1e-6) return null;
  const t = -eye[1] / direction[1];
  if (t <= 0) return null;
  return add(eye, scale(direction, t));
}

function zoomAt(clientX, clientY, factor) {
  const before = groundPointUnderClient(clientX, clientY);
  state.distance = Math.max(700, Math.min(50000, state.distance * factor));
  if (before) {
    const after = groundPointUnderClient(clientX, clientY);
    if (after) state.target = add(state.target, subtract(before, after));
  }
  render();
}

function installControls() {
  scene.tabIndex = 0;
  tourStartButton.addEventListener("click", startTour);
  tourBackButton.addEventListener("click", backTour);
  tourPauseButton.addEventListener("click", toggleTour);
  tourForwardButton.addEventListener("click", forwardTour);
  tourStopButton.addEventListener("click", stopTour);
  exitButton.addEventListener("click", () => {
    if (exitHandler) exitHandler();
  });
  scene.addEventListener("mousedown", (event) => {
    scene.focus();
    if (state.tour.active) return;
    state.dragging = event.shiftKey || event.button === 2 ? "pan" : "orbit";
    state.lastX = event.clientX;
    state.lastY = event.clientY;
  });
  window.addEventListener("mouseup", () => {
    state.dragging = null;
  });
  window.addEventListener("mousemove", (event) => {
    if (!state.dragging) return;
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    if (state.dragging === "orbit") {
      state.yaw -= dx * 0.006;
      state.pitch = Math.max(0.12, Math.min(1.45, state.pitch + dy * 0.004));
    } else {
      const scale = state.distance / Math.max(state.width, state.height);
      panBy(-dx * scale * 1.6, -dy * scale * 1.6);
    }
    render();
  });
  scene.addEventListener("contextmenu", (event) => event.preventDefault());
  scene.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (state.tour.active) return;
    zoomAt(event.clientX, event.clientY, Math.exp(event.deltaY * 0.001));
  }, { passive: false });
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (state.tour.active) {
      if (event.key === " ") {
        event.preventDefault();
        toggleTour();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        stopTour();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        backTour();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        forwardTour();
        return;
      }
      return;
    }
    if (event.key === "r" || event.key === "R" || event.key === "0") {
      resetView();
      return;
    }
    if (event.key === "-" || event.key === "_") {
      zoomBy(1.08);
      return;
    }
    if (event.key === "=" || event.key === "+") {
      zoomBy(1 / 1.08);
      return;
    }
    state.keys.add(event.key);
  });
  window.addEventListener("keyup", (event) => {
    state.keys.delete(event.key);
  });
  function step() {
    if (state.tour.active) {
      requestAnimationFrame(step);
      return;
    }
    const move = state.distance * 0.01;
    let dirty = false;
    if (state.keys.has("w") || state.keys.has("W")) { panBy(0, -move); dirty = true; }
    if (state.keys.has("s") || state.keys.has("S")) { panBy(0, move); dirty = true; }
    if (state.keys.has("a") || state.keys.has("A")) { panBy(-move, 0); dirty = true; }
    if (state.keys.has("d") || state.keys.has("D")) { panBy(move, 0); dirty = true; }
    if (state.keys.has("q") || state.keys.has("Q")) { state.target[1] -= move; dirty = true; }
    if (state.keys.has("e") || state.keys.has("E")) { state.target[1] += move; dirty = true; }
    if (state.keys.has("ArrowLeft")) { state.yaw += 0.025; dirty = true; }
    if (state.keys.has("ArrowRight")) { state.yaw -= 0.025; dirty = true; }
    if (state.keys.has("ArrowUp")) { state.pitch = Math.min(1.45, state.pitch + 0.018); dirty = true; }
    if (state.keys.has("ArrowDown")) { state.pitch = Math.max(0.12, state.pitch - 0.018); dirty = true; }
    if (dirty) render();
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

function applyWorldSnapshot(data, snapshot) {
  if (!snapshot || snapshot.schema !== "gtamaplibvc-world-v1") return data;
  const camerasByName = new Map(data.cameras.map((camera) => [camera.name, camera]));
  for (const [name, camera] of Object.entries(snapshot.cameras || {})) {
    const current = camerasByName.get(name);
    if (!current) continue;
    current.xyz = camera.xyz;
    current.ypr = camera.ypr;
    current.fov = camera.fov;
  }
  const landmarksByName = new Map(data.landmarks.map((landmark) => [landmark.name, landmark]));
  for (const [name, xyz] of Object.entries(snapshot.landmarks || {})) {
    if (landmarksByName.has(name)) {
      landmarksByName.get(name).xyz = xyz;
    } else if (snapshot.landmark_sources?.[name] !== "gtamaplib") {
      data.landmarks.push({ name, xyz });
    }
  }
  return data;
}

async function init() {
  if (initialized) return;
  initialized = true;
  let data = await loadJson(VC_DATA);
  try {
    data = applyWorldSnapshot(data, await loadJson(VC_RESULT));
  } catch (_error) {
    // The 3D experiment can run from raw imported data alone.
  }
  state.cameras = data.cameras.filter(isDisplayCamera);
  state.landmarks = data.landmarks.filter((landmark) => landmark.xyz);
  const colors = await loadJson(GTAMAPLIB_COLORS);
  if (colors.schema === "gtamaplibvc-map3d-colors-v1") {
    for (const [name, color] of Object.entries(colors.colors || {})) {
      state.colors.set(name, color);
    }
  }
  try {
    const fourSeasons = await loadJson(FOUR_SEASONS_WIREFRAME);
    if (fourSeasons.schema === "gtamaplibvc-map3d-four-seasons-v1") {
      fourSeasons.color = colorForName("Four Seasons Hotel Miami");
      state.wireframes.push(fourSeasons);
    }
  } catch (_error) {
    // Optional helper geometry.
  }
  try {
    const sunshineSkyway = await loadJson(SUNSHINE_SKYWAY_WIREFRAME);
    if (sunshineSkyway.schema === "gtamaplibvc-map3d-sunshine-skyway-v1") {
      sunshineSkyway.color = colorForName("Sunshine Skyway Bridge");
      state.wireframes.push(sunshineSkyway);
    }
  } catch (_error) {
    // Optional helper geometry.
  }
  try {
    const hanksWaffles = await loadJson(HANKS_WAFFLES_WIREFRAME);
    if (hanksWaffles.schema === "gtamaplibvc-map3d-hanks-waffles-v1") {
      hanksWaffles.color = colorForName("536 Richard Jackson Blvd");
      state.wireframes.push(hanksWaffles);
    }
  } catch (_error) {
    // Optional helper geometry.
  }
  loadTiles();
  installControls();
  render();
}

window.addEventListener("resize", render);

export function activateMap3d(options = {}) {
  exitHandler = options.onExit || null;
  setMap3dSettings(options);
  root.hidden = false;
  return init().then(() => {
    resize();
    render();
    scene.focus();
  }).catch((error) => {
    viewDataEl.textContent = error.message;
    console.error(error);
  });
}

export function setMap3dSettings(options = {}) {
  state.blurLeaks = Boolean(options.blurLeaks);
  if (!root.hidden) render();
}

export function deactivateMap3d() {
  stopTour();
  state.keys.clear();
  state.dragging = null;
  root.hidden = true;
}
