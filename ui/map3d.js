const MAP_W = 32768;
const MAP_H = 32768;
const ZERO_X = 16384;
const ZERO_Y = 16384;
const TILE_SIZE = 256;
const TILE_RANGES = {
  0: [[0, 0], [2, 2]],
  1: [[0, 1], [4, 5]],
  2: [[0, 2], [9, 11]],
  3: [[0, 4], [19, 23]],
};
const TILE_ROOT = "/gtadb.org/maps/tiles/6/yanis,13";
const VC_DATA = "/data/gtamapdata.json";
const VC_RESULT = "/optimizer/result.json";
const GTAMAPLIB_COLORS = "/ui/data/map3d-colors.json";
const FOUR_SEASONS_WIREFRAME = "/ui/data/map3d-four-seasons.json";
const SUNSHINE_SKYWAY_WIREFRAME = "/ui/data/map3d-sunshine-skyway.json";
const HOMESTEAD_WATER_TOWER_WIREFRAME = "/ui/data/map3d-homestead-water-tower.json";
const HANKS_WAFFLES_WIREFRAME = "/ui/data/map3d-hanks-waffles.json";
const FAKE_CAMERA_SUFFIX = " Fake Cam";
const AIWE_CAMERA_NAME = "AI World Editor Map (4K)";
const YANIS_WATER_COLOR = [44 / 255, 103 / 255, 164 / 255, 1];
const DAY_SKY_COLOR = [0.43, 0.72, 0.92, 1];
const CAMERA_CONE_DISTANCE = 100;
const CAMERA_THUMBNAIL_DISTANCE = CAMERA_CONE_DISTANCE * 0.995;
const TOUR_DWELL_MS = 1200;
const TOUR_EYE_CONTROL_MIN_Z = 10;
const FOUR_SEASONS_TOUR_EYE_CONTROL_MIN_Z = 100;
const CUSTOM_TOUR_EYE_CONTROL_MIN_Z = 25;
const CLICK_MOVE_TOLERANCE = 5;
const MIN_DISTANCE = 100;
const MIN_PITCH = -1.05;
const MAX_PITCH = 1.5;
const MIN_NAVIGATION_EYE_Y = 10;
const MAP3D_POSE_STORAGE_KEY = "gtamaplib-vc.map3dPose";
const GAME_SPAWN_STORAGE_KEY = "gtamaplib-vc.gameSpawn";
const GAME_START_EYE = [-6250, 380, -5420];
const GAME_START_TARGET = [-6250, 265, -5050];
const MAX_TARGET_RADIUS = 32768;
const ACTIVE_SCREENSHOT_DIM_RADIUS = 100;
const ACTIVE_SCREENSHOT_DIM_ALPHA = 0.25;
const FOUR_SEASONS_TOUR_CAMERA_NAMES = [
  "Leonida Keys 01 (Airplane) (X)",
  "Ocean near Keys (N)",
  "Grassrivers 02 (Watson Bay)",
  "Rooftop Party",
  "Vice Beach (B)",
  "Vice City Postcard",
  "Skyline",
  "Vice City 01 (Vice City Sign)",
  "Prison",
  "Street (Bikers) (B)",
  "Port Vice City (A)",
  "Little Haiti",
  "Shitzu Squalo 01 (Bay)",
  "Motorboats (B)",
  "Interchange",
  "Metro (SE) (A) (4K)",
  "Highway (Peacock Bay) (B)",
  "'95 Grotti Cheetah 04 (Garage)",
  "Tennis Stadium (4K)",
  "Raul Bautista 03 (Motorboat)",
  "Ultimate Edition 02 (Green Sports Car)",
];
const CUSTOM_TOUR_CAMERA_NAMES = [
  "Green Sports Car",
  "Ultimate Edition 02 (Green Sports Car)",
  "'95 Grotti Cheetah 04 (Garage)",
  "Vintage Vice City Pack 02 (Port)",
  "Jason's Safehouse Vehicles (X)",
  "Crest Kayak",
  "Stock 305 Clothing Store 01 (Van)",
  "Vintage Vice City Outfits and Hairstyles 04 (Rooftop)",
  "Shitzu Squalo 01 (Bay)",
  "Port Vice City (A)",
];

const root = document.querySelector("#map3d-root");
const scene = document.querySelector("#map3d-scene");
const overlay = document.querySelector("#map3d-overlay");
const exitButton = document.querySelector("#map3d-exit");
const resetButton = document.querySelector("#map3d-reset");
const gameButton = document.querySelector("#map3d-game");
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
  dragMoved: false,
  dragStartX: 0,
  dragStartY: 0,
  lastX: 0,
  lastY: 0,
  dragGroundPoint: null,
  clickCamera: null,
  keys: new Set(),
  tiles: [],
  cameras: [],
  landmarks: [],
  wireframes: [],
  colors: new Map(),
  thumbnails: new Map(),
  blurLeaks: true,
  useMonospaceFont: false,
  activeScreenshotCamera: null,
  transitionRaf: null,
  controlsRaf: null,
  tour: {
    active: false,
    mode: "screenshots",
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

function projectPointForView(eye, target, vfov, point) {
  const projection = perspective(vfov * Math.PI / 180, state.width / state.height, 1, 90000);
  const view = lookAt(eye, target, [0, 1, 0]);
  const matrix = mat4Multiply(projection, view);
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (!Number.isFinite(w) || w <= 0) return null;
  return {
    x: (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    y: (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    z: (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w,
  };
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

function yawPitchForView(eye, target) {
  const offset = subtract(eye, target);
  const distance = Math.max(1, Math.hypot(offset[0], offset[1], offset[2]));
  return {
    yaw: Math.atan2(offset[0], offset[2]),
    pitch: Math.asin(Math.max(-1, Math.min(1, offset[1] / distance))),
    distance,
  };
}

function targetFromYawPitch(eye, yaw, pitch, distance) {
  const cp = Math.cos(pitch);
  return [
    eye[0] - Math.sin(yaw) * cp * distance,
    eye[1] - Math.sin(pitch) * distance,
    eye[2] - Math.cos(yaw) * cp * distance,
  ];
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

function glToWorld(v) {
  return [v[0], -v[2], v[1]];
}

function writeGameSpawnFromCurrentView() {
  const eye = glToWorld(cameraEye());
  const target = glToWorld(state.target);
  const direction = normalize(subtract(target, eye));
  const horizontal = Math.hypot(direction[0], direction[1]) || 1;
  sessionStorage.setItem(GAME_SPAWN_STORAGE_KEY, JSON.stringify({
    pos: [eye[0], eye[1], Math.max(80, eye[2])],
    yaw: Math.atan2(-direction[0] / horizontal, direction[1] / horizontal),
  }));
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
  for (const z of Object.keys(TILE_RANGES).map(Number).sort((a, b) => a - b)) {
    const [[x0, y0], [x1, y1]] = TILE_RANGES[z];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        state.tiles.push(loadTile(z, x, y));
      }
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

function thickenPillarLines(points) {
  if (!points.length) return points;
  const thick = [];
  const offsets = [
    [0, 0],
    [0.34, 0],
    [-0.34, 0],
    [0, 0.34],
    [0, -0.34],
    [0.68, 0],
    [-0.68, 0],
    [0, 0.68],
    [0, -0.68],
  ];
  for (const [x, z] of offsets) {
    for (let index = 0; index < points.length; index += 3) {
      thick.push(points[index] + x, points[index + 1], points[index + 2] + z);
    }
  }
  return thick;
}

function thickenVerticalWireframeLines(points) {
  if (!points.length) return points;
  const thick = [];
  const offsets = [
    [0, 0],
    [0.38, 0],
    [-0.38, 0],
    [0, 0.38],
    [0, -0.38],
  ];
  for (const [x, z] of offsets) {
    for (let index = 0; index < points.length; index += 3) {
      thick.push(points[index] + x, points[index + 1], points[index + 2] + z);
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

function landmarkGlPoint(name) {
  const landmark = state.landmarks.find((item) => item.name === name);
  if (!landmark?.xyz) return null;
  return worldToGl(landmark.xyz[0], landmark.xyz[1], landmark.xyz[2]);
}

function landmarkGroupGlPoint(prefix) {
  const points = state.landmarks
    .filter((item) => item.name.startsWith(prefix) && item.xyz)
    .map((item) => worldToGl(item.xyz[0], item.xyz[1], item.xyz[2]));
  if (!points.length) return null;
  return points.reduce((sum, point) => add(sum, point), [0, 0, 0]).map((value) => value / points.length);
}

function lookTargetForScreenPoint(eye, target, vfov, point, screenPoint) {
  const epsilon = 0.0008;
  const view = yawPitchForView(eye, target);
  let yaw = view.yaw;
  let pitch = view.pitch;
  const project = (nextYaw, nextPitch) => {
    const nextTarget = targetFromYawPitch(eye, nextYaw, nextPitch, view.distance);
    return projectPointForView(eye, nextTarget, vfov, point);
  };
  for (let index = 0; index < 6; index++) {
    const current = project(yaw, pitch);
    if (!current) break;
    const errorX = current.x - screenPoint.x;
    const errorY = current.y - screenPoint.y;
    if (Math.hypot(errorX, errorY) < 0.001) break;
    const yawProjection = project(yaw + epsilon, pitch);
    const pitchProjection = project(yaw, pitch + epsilon);
    if (!yawProjection || !pitchProjection) break;
    const ax = (yawProjection.x - current.x) / epsilon;
    const ay = (yawProjection.y - current.y) / epsilon;
    const bx = (pitchProjection.x - current.x) / epsilon;
    const by = (pitchProjection.y - current.y) / epsilon;
    const determinant = ax * by - bx * ay;
    if (Math.abs(determinant) < 0.000001) break;
    yaw -= (by * errorX - bx * errorY) / determinant;
    pitch -= (-ay * errorX + ax * errorY) / determinant;
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
  }
  return targetFromYawPitch(eye, yaw, pitch, view.distance);
}

function idSortKey(camera) {
  const id = String(camera.id || "");
  const match = id.match(/^([A-Z])(\d+)(?:\/(\d+))?/i);
  if (!match) return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, id];
  const letterOrder = { L: 0, T: 1, S: 2 };
  const letter = match[1].toUpperCase();
  return [
    Number(match[2]),
    letterOrder[letter] ?? Number.POSITIVE_INFINITY,
    match[3] === undefined ? Number.POSITIVE_INFINITY : Number(match[3]),
    id,
  ];
}

function compareCameraIds(a, b) {
  const ak = idSortKey(a);
  const bk = idSortKey(b);
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] < bk[i]) return -1;
    if (ak[i] > bk[i]) return 1;
  }
  return (a.order ?? a.map3dOrder ?? 0) - (b.order ?? b.map3dOrder ?? 0);
}

function makeTourSegment(from, to) {
  const fromDirection = normalize(subtract(from.target, from.eye));
  const toDirection = normalize(subtract(to.target, to.eye));
  const span = Math.hypot(to.eye[0] - from.eye[0], to.eye[1] - from.eye[1], to.eye[2] - from.eye[2]);
  const handle = Math.max(350, Math.min(2600, span * 0.35));
  const eyeC1 = add(from.eye, scale(fromDirection, handle));
  const eyeC2 = subtract(to.eye, scale(toDirection, handle));
  eyeC1[1] = Math.max(eyeC1[1], TOUR_EYE_CONTROL_MIN_Z);
  eyeC2[1] = Math.max(eyeC2[1], TOUR_EYE_CONTROL_MIN_Z);
  return {
    from,
    to,
    eyeC1,
    eyeC2,
    targetC1: add(from.target, scale(fromDirection, handle)),
    targetC2: subtract(to.target, scale(toDirection, handle)),
    duration: Math.max(2600, Math.min(7000, span * 0.32)),
  };
}

function makeFourSeasonsTourSegment(from, to) {
  const landmark = landmarkGroupGlPoint("Four Seasons Hotel Miami") || landmarkGlPoint("Four Seasons Hotel Miami (NW)");
  const segment = makeTourSegment(from, to);
  if (!landmark) return segment;
  const fromScreen = projectPointForView(from.eye, from.target, from.vfov || 45, landmark);
  const toScreen = projectPointForView(to.eye, to.target, to.vfov || 45, landmark);
  if (!fromScreen || !toScreen) return segment;
  segment.eyeC1[1] = Math.max(segment.eyeC1[1], FOUR_SEASONS_TOUR_EYE_CONTROL_MIN_Z);
  segment.eyeC2[1] = Math.max(segment.eyeC2[1], FOUR_SEASONS_TOUR_EYE_CONTROL_MIN_Z);
  return {
    ...segment,
    landmark,
    fromScreen: { x: fromScreen.x, y: fromScreen.y },
    toScreen: { x: toScreen.x, y: toScreen.y },
    fourSeasons: true,
  };
}

function makeCustomTourSegment(from, to) {
  const segment = makeTourSegment(from, to);
  segment.eyeC1[1] = Math.max(segment.eyeC1[1], CUSTOM_TOUR_EYE_CONTROL_MIN_Z);
  segment.eyeC2[1] = Math.max(segment.eyeC2[1], CUSTOM_TOUR_EYE_CONTROL_MIN_Z);
  return segment;
}

function makeTourSegmentForMode(from, to) {
  if (state.tour.mode === "four-seasons") return makeFourSeasonsTourSegment(from, to);
  if (state.tour.mode === "custom") return makeCustomTourSegment(from, to);
  return makeTourSegment(from, to);
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

function setActiveScreenshotCamera(camera) {
  state.activeScreenshotCamera = camera || null;
}

function clearActiveScreenshotCamera() {
  state.activeScreenshotCamera = null;
}

function isDimmedNearActiveScreenshot(camera) {
  const active = state.activeScreenshotCamera;
  if (!active || camera === active || !active.xyz || !camera.xyz) return false;
  return Math.hypot(
    camera.xyz[0] - active.xyz[0],
    camera.xyz[1] - active.xyz[1],
    camera.xyz[2] - active.xyz[2],
  ) <= ACTIVE_SCREENSHOT_DIM_RADIUS;
}

function stopTourFrame() {
  if (state.tour.raf) {
    cancelAnimationFrame(state.tour.raf);
    state.tour.raf = null;
  }
}

function stopTransitionFrame() {
  if (state.transitionRaf) {
    cancelAnimationFrame(state.transitionRaf);
    state.transitionRaf = null;
  }
}

function stopControlsFrame() {
  if (state.controlsRaf) {
    cancelAnimationFrame(state.controlsRaf);
    state.controlsRaf = null;
  }
}

function startControlsFrame() {
  if (!state.controlsRaf) state.controlsRaf = requestAnimationFrame(updateControls);
}

function suspendMap3d() {
  stopTour();
  stopTransitionFrame();
  stopControlsFrame();
  state.keys.clear();
  state.dragging = null;
  state.dragGroundPoint = null;
}

function animateToView(to, onDone) {
  stopTourFrame();
  stopTransitionFrame();
  state.tour.active = false;
  state.tour.paused = false;
  clearActiveScreenshotCamera();
  updateTourButton();
  const segment = makeTourSegment(currentView(), to);
  const startedAt = performance.now();
  function step(now) {
    const t = Math.min(1, (now - startedAt) / segment.duration);
    const eased = smoothStep(t);
    const eye = cubicBezier3(segment.from.eye, segment.eyeC1, segment.eyeC2, segment.to.eye, eased);
    const target = cubicBezier3(segment.from.target, segment.targetC1, segment.targetC2, segment.to.target, eased);
    applyEyeTarget(eye, target);
    state.vfov = lerp(segment.from.vfov || 45, segment.to.vfov || 45, eased);
    render();
    if (t >= 1) {
      state.transitionRaf = null;
      onDone?.();
      return;
    }
    state.transitionRaf = requestAnimationFrame(step);
  }
  state.transitionRaf = requestAnimationFrame(step);
}

function gameStartView() {
  return {
    eye: [...GAME_START_EYE],
    target: [...GAME_START_TARGET],
    vfov: 45,
  };
}

function applyStoredPose() {
  const raw = sessionStorage.getItem(MAP3D_POSE_STORAGE_KEY);
  if (!raw) return false;
  sessionStorage.removeItem(MAP3D_POSE_STORAGE_KEY);
  try {
    const pose = JSON.parse(raw);
    if (!Array.isArray(pose.eye) || !Array.isArray(pose.target)) return false;
    applyEyeTarget(pose.eye, pose.target);
    state.vfov = pose.vfov || state.vfov;
    return true;
  } catch (_error) {
    return false;
  }
}

function applyInitialView(view) {
  if (!view) return false;
  if (view.type === "camera") {
    const camera = state.cameras.find((item) => item.name === view.cameraName);
    if (!camera?.xyz || !camera.ypr || !camera.fov) return false;
    applyTourView(viewForCamera(camera), camera);
    return true;
  }
  if (view.type === "map") {
    const vfov = view.vfov || 45;
    const height = Math.max(1, view.height || state.height);
    const metersPerPixel = MAP_W / (1024 * Math.pow(2, view.zoom || 0));
    const visibleMeters = metersPerPixel * height;
    const distance = Math.max(MIN_DISTANCE, visibleMeters / (2 * Math.tan((vfov * Math.PI / 180) / 2)));
    const target = worldToGl(view.centerX || 0, view.centerY || 0, 0);
    const pitch = MAX_PITCH;
    const yaw = 0;
    const cp = Math.cos(pitch);
    const eye = [
      target[0] + Math.sin(yaw) * cp * distance,
      target[1] + Math.sin(pitch) * distance,
      target[2] + Math.cos(yaw) * cp * distance,
    ];
    clearActiveScreenshotCamera();
    applyEyeTarget(eye, target);
    state.vfov = vfov;
    render();
    return true;
  }
  return false;
}

function currentMapSnapshot() {
  const rect = scene.getBoundingClientRect();
  const center = groundPointUnderClient(rect.left + rect.width / 2, rect.top + rect.height / 2) || state.target;
  const world = glToWorld(center);
  const metersPerPixel = 2 * state.distance * Math.tan((state.vfov * Math.PI / 180) / 2) / Math.max(1, state.height);
  return {
    type: "map",
    centerX: world[0],
    centerY: world[1],
    zoom: Math.max(0, Math.min(6, Math.log2(MAP_W / (1024 * metersPerPixel)))),
  };
}

function startTourSegment(from, camera) {
  clearActiveScreenshotCamera();
  const to = viewForCamera(camera);
  state.tour.segment = makeTourSegmentForMode(from, to);
  state.tour.elapsed = 0;
  state.tour.holdUntil = 0;
  state.tour.holdRemaining = 0;
  state.tour.startedAt = performance.now();
}

function applyTourView(view, camera = null) {
  setActiveScreenshotCamera(camera);
  applyEyeTarget(view.eye, view.target);
  state.vfov = view.vfov || 45;
  render();
}

function ensureTourCameras() {
  if (state.tour.mode === "four-seasons" || state.tour.mode === "custom") {
    const camerasByName = new Map(state.cameras.map((camera) => [camera.name, camera]));
    const cameraNames = state.tour.mode === "custom" ? CUSTOM_TOUR_CAMERA_NAMES : FOUR_SEASONS_TOUR_CAMERA_NAMES;
    state.tour.cameras = cameraNames
      .map((name) => camerasByName.get(name))
      .filter((camera) => camera?.xyz && camera.ypr && camera.fov && !(state.blurLeaks && camera.id?.startsWith("L")));
  } else {
    state.tour.cameras = state.cameras
      .filter((camera) => camera.xyz && camera.ypr && camera.fov && !(state.blurLeaks && camera.id?.startsWith("L")))
      .sort(compareCameraIds);
  }
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
  state.tour.segment = makeTourSegmentForMode(view, view);
  state.tour.elapsed = 0;
  state.tour.holdRemaining = paused ? TOUR_DWELL_MS : 0;
  state.tour.holdUntil = paused ? 0 : performance.now() + TOUR_DWELL_MS;
  state.tour.startedAt = performance.now();
  applyTourView(view, state.tour.cameras[state.tour.index]);
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
    clearActiveScreenshotCamera();
    startTourSegment(segment.to, state.tour.cameras[state.tour.index]);
  }
  const segment = state.tour.segment;
  state.tour.elapsed = now - state.tour.startedAt;
  const t = Math.min(1, state.tour.elapsed / segment.duration);
  const eased = smoothStep(t);
  const eye = cubicBezier3(segment.from.eye, segment.eyeC1, segment.eyeC2, segment.to.eye, eased);
  let target = cubicBezier3(segment.from.target, segment.targetC1, segment.targetC2, segment.to.target, eased);
  const vfov = lerp(segment.from.vfov || 45, segment.to.vfov || 45, eased);
  if (segment.fourSeasons && eased > 0 && eased < 1) {
    target = lookTargetForScreenPoint(eye, target, vfov, segment.landmark, {
      x: lerp(segment.fromScreen.x, segment.toScreen.x, eased),
      y: lerp(segment.fromScreen.y, segment.toScreen.y, eased),
    });
  }
  if (t >= 1) {
    setActiveScreenshotCamera(state.tour.cameras[state.tour.index]);
  } else {
    clearActiveScreenshotCamera();
  }
  applyEyeTarget(eye, target);
  state.vfov = vfov;
  render();
  if (t >= 1) {
    state.tour.holdUntil = now + TOUR_DWELL_MS;
  }
  state.tour.raf = requestAnimationFrame(animateTour);
}

function startTour(mode = "screenshots") {
  if (state.tour.mode !== mode) {
    stopTour();
    state.tour.mode = mode;
  }
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
    startTour(state.tour.mode);
  }
}

function stopTour() {
  stopTourFrame();
  clearActiveScreenshotCamera();
  state.tour.active = false;
  state.tour.mode = "screenshots";
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
  const corners = cameraThumbnailCorners(camera);
  if (!corners) return null;
  return new Float32Array([
    ...corners[0], 0, 1,
    ...corners[1], 1, 1,
    ...corners[2], 1, 0,
    ...corners[0], 0, 1,
    ...corners[2], 1, 0,
    ...corners[3], 0, 0,
  ]);
}

function cameraThumbnailCorners(camera) {
  if (!camera.xyz || !camera.ypr || !camera.fov) return null;
  const hf = Math.tan((camera.fov[0] || 50) * Math.PI / 360);
  const vf = Math.tan((camera.fov[1] || 35) * Math.PI / 360);
  return [[-hf, vf], [hf, vf], [hf, -vf], [-hf, -vf]].map(([u, v]) => {
    const d = directionFromYpr(camera.ypr, u, v);
    return worldToGl(
      camera.xyz[0] + d[0] * CAMERA_THUMBNAIL_DISTANCE,
      camera.xyz[1] + d[1] * CAMERA_THUMBNAIL_DISTANCE,
      camera.xyz[2] + d[2] * CAMERA_THUMBNAIL_DISTANCE,
    );
  });
}

function cameraThumbnailInView(camera, matrix) {
  const corners = cameraThumbnailCorners(camera);
  if (!corners) return false;
  const points = corners.map((corner) => transformPoint(matrix, corner));
  const isFinitePoint = (point) => point.every((value) => Number.isFinite(value));
  if (!points.every(isFinitePoint)) return false;
  if (points.some((point) => (
    point[2] >= -1 && point[2] <= 1 &&
    point[0] >= -1.2 && point[0] <= 1.2 &&
    point[1] >= -1.2 && point[1] <= 1.2
  ))) {
    return true;
  }
  if (!points.every((point) => point[2] >= -1 && point[2] <= 1)) return false;
  return pointInScreenQuad({ x: 0, y: 0 }, points.map((point) => ({ x: point[0], y: point[1] })));
}

function pointInScreenTriangle(point, a, b, c) {
  const area = (p1, p2, p3) => (
    (p1.x - p3.x) * (p2.y - p3.y) -
    (p2.x - p3.x) * (p1.y - p3.y)
  );
  const b1 = area(point, a, b) < 0;
  const b2 = area(point, b, c) < 0;
  const b3 = area(point, c, a) < 0;
  return b1 === b2 && b2 === b3;
}

function pointInScreenQuad(point, points) {
  const [a, b, c, d] = points;
  return (
    pointInScreenTriangle(point, a, b, c) ||
    pointInScreenTriangle(point, a, c, d)
  );
}

function pointInScreenBounds(point) {
  return point.x >= -1 && point.x <= 1 && point.y >= -1 && point.y <= 1;
}

function segmentIntersectsScreenBoundary(a, b) {
  for (const axis of ["x", "y"]) {
    for (const boundary of [-1, 1]) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-9) continue;
      const t = (boundary - a[axis]) / delta;
      if (t < 0 || t > 1) continue;
      const otherAxis = axis === "x" ? "y" : "x";
      const otherValue = a[otherAxis] + (b[otherAxis] - a[otherAxis]) * t;
      if (otherValue >= -1 && otherValue <= 1) return true;
    }
  }
  return false;
}

function projectedQuadIntersectsScreen(points) {
  if (points.some(pointInScreenBounds)) return true;
  const screenCorners = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];
  if (screenCorners.some((point) => pointInScreenQuad(point, points))) return true;
  return points.some((point, index) => (
    segmentIntersectsScreenBoundary(point, points[(index + 1) % points.length])
  ));
}

function projectedThumbnail(camera, matrix, rect) {
  if (shouldBlurCameraThumbnail(camera)) return null;
  if (!camera.thumbnail) return null;
  const thumbnail = state.thumbnails.get(`/${camera.thumbnail}`);
  if (!thumbnail?.loaded) return null;
  const corners = cameraThumbnailCorners(camera);
  if (!corners) return null;
  const points = corners.map((corner) => {
    const p = transformPoint(matrix, corner);
    if (p[2] < -1 || p[2] > 1) return null;
    return {
      x: rect.left + (p[0] + 1) * rect.width * 0.5,
      y: rect.top + (1 - p[1]) * rect.height * 0.5,
      z: p[2],
    };
  });
  if (points.some((point) => !point)) return null;
  return {
    camera,
    points,
    depth: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}

function cameraThumbnailAtClient(clientX, clientY) {
  const rect = scene.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const matrix = viewProjection();
  const point = { x: clientX, y: clientY };
  const hits = [];
  for (const camera of state.cameras) {
    const thumbnail = projectedThumbnail(camera, matrix, rect);
    if (!thumbnail) continue;
    if (pointInScreenQuad(point, thumbnail.points)) {
      hits.push(thumbnail);
    }
  }
  hits.sort((a, b) => a.depth - b.depth);
  return hits[0]?.camera || null;
}

function drawCameraThumbnail(camera, matrix) {
  if (!cameraThumbnailInView(camera, matrix)) return;
  const thumbnail = thumbnailTexture(camera);
  if (!thumbnail?.loaded) return;
  const vertices = cameraThumbnailVertices(camera);
  if (!vertices) return;
  drawTexturedVertices(vertices, thumbnail.texture, matrix, {
    alpha: isDimmedNearActiveScreenshot(camera) ? ACTIVE_SCREENSHOT_DIM_ALPHA : 0.78,
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
  const groups = { single: [], thin: [], bold: [], verticalBold: [], pillar: [] };
  for (const [index, segment] of (wireframe.segments || []).entries()) {
    const points = Array.isArray(segment) ? segment : segment.points;
    let style = Array.isArray(segment) ? "thin" : segment.style || "thin";
    if (wireframe.name === "Sunshine Skyway Bridge" && index < 2) style = "pillar";
    if (!points || points.length !== 2) continue;
    const target = style === "pillar"
      ? groups.pillar
      : style === "verticalBold"
        ? groups.verticalBold
        : style === "bold"
          ? groups.bold
          : style === "single"
            ? groups.single
            : groups.thin;
    target.push(...worldToGl(points[0][0], points[0][1], points[0][2]));
    target.push(...worldToGl(points[1][0], points[1][1], points[1][2]));
  }
  return groups;
}

function wireframeFaceTriangles(wireframe) {
  const triangles = [];
  for (const face of wireframe.faces || []) {
    if (!face || face.length !== 4) continue;
    triangles.push(
      ...worldToGl(face[0][0], face[0][1], face[0][2]),
      ...worldToGl(face[1][0], face[1][1], face[1][2]),
      ...worldToGl(face[2][0], face[2][1], face[2][2]),
      ...worldToGl(face[0][0], face[0][1], face[0][2]),
      ...worldToGl(face[2][0], face[2][1], face[2][2]),
      ...worldToGl(face[3][0], face[3][1], face[3][2])
    );
  }
  return triangles;
}

const SEFC_HEIGHT_MAP = `
56
58 55
61 58 56
62 61 58 56
62 62 61 58 56
62 62 62 61 58 56
62 62 62 62 61 58 56
62 62 62 62 62 61 58 56
62 62 63 63 62 62 61 58 56
62 62 63 63 62 62 62 60 60
62 62 63 63 62 62 62 60 58
62 62 63 63 62 62 60 58 56
62 62 62 62 62 60 58 56 54
62 62 62 62 60 58 56 54 52
62 62 62 60 58 56 54 52 50
62 62 60 58 56 54 52 50 48
`;

function parseSefcHeightMap(source) {
  return source.trim().split(/\n+/).map((line) => (
    line.trim().split(/\s+/).map((value) => Number(value))
  ));
}

function createWdnaFmWireframe(landmarks) {
  const points = new Map(landmarks.map((landmark) => [landmark.name, landmark.xyz]));
  const top = points.get("WDNA FM");
  const rings = [0, 1, 2, 3, 4].map((level) => [
    points.get(`WDNA FM (N${level})`),
    points.get(`WDNA FM (SE${level})`),
    points.get(`WDNA FM (SW${level})`),
  ]);
  if (!top || rings.some((ring) => ring.some((point) => !point))) return null;

  const segments = [];
  const line = (a, b, style = "single") => segments.push({ points: [a, b], style });
  const ring = (points, style = "single") => {
    line(points[0], points[1], style);
    line(points[1], points[2], style);
    line(points[2], points[0], style);
  };

  ring(rings[0]);
  ring(rings[1]);
  ring(rings[2]);
  ring(rings[3]);
  ring(rings[4]);
  for (let i = 0; i < 3; i++) {
    line(rings[0][i], rings[4][i]);
    line(rings[4][i], top);
  }
  return { name: "WDNA FM", color: colorForName("WDNA FM"), segments };
}

function createSefcTemporaryWireframe(landmarks, { orientationDeg = 0, offset = [0, 0] } = {}) {
  const landmark = landmarks.find((item) => item.name === "Southeast Financial Center")?.xyz;
  if (!landmark) return null;
  const heights = parseSefcHeightMap(SEFC_HEIGHT_MAP);
  const cellSize = 4;
  const floorHeight = 4;
  const rowCount = heights.length;
  const columnCount = Math.max(...heights.map((row) => row.length));
  const angle = orientationDeg * Math.PI / 180;
  const east = [Math.cos(angle), -Math.sin(angle)];
  const north = [Math.sin(angle), Math.cos(angle)];
  const maxHeight = Math.max(...heights.flat());
  const highestCells = heights.flatMap((row, rowIndex) => (
    row.map((height, columnIndex) => ({ height, rowIndex, columnIndex }))
      .filter(({ height }) => height === maxHeight)
  ));
  const anchorX = (
    Math.min(...highestCells.map(({ columnIndex }) => columnIndex)) +
    Math.max(...highestCells.map(({ columnIndex }) => columnIndex)) +
    1 - columnCount
  ) * cellSize / 2;
  const anchorY = (
    rowCount - 1 -
    Math.min(...highestCells.map(({ rowIndex }) => rowIndex)) -
    Math.max(...highestCells.map(({ rowIndex }) => rowIndex))
  ) * cellSize / 2;
  const anchor = [landmark[0] + offset[0], landmark[1] + offset[1]];
  const center = [
    anchor[0] - east[0] * anchorX - north[0] * anchorY,
    anchor[1] - east[1] * anchorX - north[1] * anchorY,
  ];
  const worldPoint = (x, y, z) => [
    center[0] + east[0] * x + north[0] * y,
    center[1] + east[1] * x + north[1] * y,
    z,
  ];
  const heightAt = (row, column) => heights[row]?.[column] || 0;
  const key = (point) => point.map((value) => value.toFixed(3)).join(",");
  const edges = new Map();
  const faces = [];
  const addEdge = (a, b) => {
    const ak = key(a);
    const bk = key(b);
    edges.set(ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`, [a, b]);
  };
  const addFace = (a, b, c, d) => {
    faces.push([a, b, c, d]);
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, d);
    addEdge(d, a);
  };

  for (let row = 0; row < rowCount; row++) {
    for (let column = 0; column < heights[row].length; column++) {
      const floors = heights[row][column];
      const x0 = (column - columnCount / 2) * cellSize;
      const x1 = x0 + cellSize;
      const y1 = (rowCount / 2 - row) * cellSize;
      const y0 = y1 - cellSize;
      for (let floor = 0; floor < floors; floor++) {
        const z0 = floor * floorHeight;
        const z1 = z0 + floorHeight;
        if (floor === floors - 1) {
          addFace(
            worldPoint(x0, y0, z1),
            worldPoint(x1, y0, z1),
            worldPoint(x1, y1, z1),
            worldPoint(x0, y1, z1)
          );
        }
        if (heightAt(row - 1, column) <= floor) {
          addFace(
            worldPoint(x0, y1, z0),
            worldPoint(x1, y1, z0),
            worldPoint(x1, y1, z1),
            worldPoint(x0, y1, z1)
          );
        }
        if (heightAt(row + 1, column) <= floor) {
          addFace(
            worldPoint(x1, y0, z0),
            worldPoint(x0, y0, z0),
            worldPoint(x0, y0, z1),
            worldPoint(x1, y0, z1)
          );
        }
        if (heightAt(row, column - 1) <= floor) {
          addFace(
            worldPoint(x0, y0, z0),
            worldPoint(x0, y1, z0),
            worldPoint(x0, y1, z1),
            worldPoint(x0, y0, z1)
          );
        }
        if (heightAt(row, column + 1) <= floor) {
          addFace(
            worldPoint(x1, y1, z0),
            worldPoint(x1, y0, z0),
            worldPoint(x1, y0, z1),
            worldPoint(x1, y1, z1)
          );
        }
      }
    }
  }
  return {
    name: "SEFC",
    color: [1, 1, 1],
    faceColor: colorForName("Southeast Financial Center"),
    faces,
    segments: [...edges.values()].map((points) => ({ points, style: "single" })),
  };
}

function createOperaTowerWireframe(landmarks) {
  const center = landmarks.find((landmark) => landmark.name === "Opera Tower")?.xyz;
  if (!center) return null;
  const topZ = center[2];
  const topCapBaseZ = Math.max(0, topZ - 6);
  const shoulderBaseZ = Math.max(0, topZ - 12);
  const fullRadiusX = 30;
  const fullRadiusY = 15;
  const topRadiusX = fullRadiusX / 2;
  const topRadiusY = fullRadiusY / 4;
  const segments = [];
  const point = (angleDeg, radiusX, radiusY, z) => {
    const angle = angleDeg * Math.PI / 180;
    return [
      center[0] + Math.sin(angle) * radiusX,
      center[1] + Math.cos(angle) * radiusY,
      z,
    ];
  };
  const line = (a, b, style = "single") => segments.push({ points: [a, b], style });
  const ring = (z, radiusX, radiusY, angles, style = "single") => {
    const points = angles.map((angle) => point(angle, radiusX, radiusY, z));
    for (let index = 0; index < points.length; index++) {
      line(points[index], points[(index + 1) % points.length], style);
    }
  };
  const partialRing = (z, radiusX, radiusY, angles, shouldDraw, style = "single") => {
    const points = angles.map((angle) => point(angle, radiusX, radiusY, z));
    for (let index = 0; index < points.length; index++) {
      const startAngle = angles[index];
      const endAngle = angles[(index + 1) % points.length];
      if (shouldDraw(startAngle, endAngle)) {
        line(points[index], points[(index + 1) % points.length], style);
      }
    }
  };
  const verticals = (z0, z1, radiusX, radiusY, angles, style = "single") => {
    for (const angle of angles) line(point(angle, radiusX, radiusY, z0), point(angle, radiusX, radiusY, z1), style);
  };
  const radialConnectors = (z, fromRadiusX, fromRadiusY, toRadiusX, toRadiusY, angles, style = "single") => {
    for (const angle of angles) line(point(angle, fromRadiusX, fromRadiusY, z), point(angle, toRadiusX, toRadiusY, z), style);
  };
  const regularAngles = Array.from({ length: 36 }, (_, index) => 5 + index * 10);
  const shaftAngles = [30, 90, 150, 210, 270, 330].flatMap((angle) => [angle - 5, angle + 5]);
  const skipFloorSegments = new Set(shaftAngles.filter((angle) => angle % 60 === 25).map((angle) => `${angle}:${angle + 10}`));

  ring(0, fullRadiusX, fullRadiusY, regularAngles, "bold");
  for (let z = 4; z < shoulderBaseZ; z += 4) {
    partialRing(
      z,
      fullRadiusX,
      fullRadiusY,
      regularAngles,
      (startAngle, endAngle) => !skipFloorSegments.has(`${startAngle}:${endAngle}`),
      "single"
    );
  }
  ring(shoulderBaseZ, fullRadiusX, fullRadiusY, regularAngles, "bold");
  verticals(0, shoulderBaseZ, fullRadiusX, fullRadiusY, regularAngles);
  verticals(0, shoulderBaseZ, fullRadiusX, fullRadiusY, shaftAngles, "verticalBold");
  ring(topCapBaseZ, fullRadiusX, fullRadiusY, regularAngles, "bold");
  verticals(shoulderBaseZ, topCapBaseZ, fullRadiusX, fullRadiusY, regularAngles);
  ring(topCapBaseZ, topRadiusX, topRadiusY, regularAngles, "bold");
  radialConnectors(topCapBaseZ, fullRadiusX, fullRadiusY, topRadiusX, topRadiusY, regularAngles);
  ring(topZ, topRadiusX, topRadiusY, regularAngles, "bold");
  verticals(topCapBaseZ, topZ, topRadiusX, topRadiusY, regularAngles);

  return { name: "Opera Tower", color: colorForName("Opera Tower"), segments };
}

function createPortofinoTowerWireframe(landmarks) {
  const points = new Map(landmarks.map((landmark) => [landmark.name, landmark.xyz]));
  const nw = points.get("Portofino Tower (NW)");
  const south = points.get("Portofino Tower (S)");
  if (!nw || !south) return null;
  const dx = south[0] - nw[0];
  const dy = south[1] - nw[1];
  const midpointNs = [(nw[0] + south[0]) / 2, (nw[1] + south[1]) / 2];
  const triangleHeight = Math.sqrt(3) / 2;
  const candidates = [
    [midpointNs[0] - dy * triangleHeight, midpointNs[1] + dx * triangleHeight, nw[2]],
    [midpointNs[0] + dy * triangleHeight, midpointNs[1] - dx * triangleHeight, nw[2]],
  ];
  const ne = candidates.find((point) => point[0] > nw[0] && point[1] > south[1])
    || candidates.sort((a, b) => (b[0] - nw[0]) + (b[1] - south[1]) - ((a[0] - nw[0]) + (a[1] - south[1])))[0];
  const midpoint = [
    (nw[0] + ne[0] + south[0]) / 3,
    (nw[1] + ne[1] + south[1]) / 3,
  ];
  const sideLength = 10;
  const halfDiagonal = sideLength / Math.sqrt(2);
  const pyramidTopZ = nw[2];
  const shaftTopZ = Math.max(0, pyramidTopZ - 7);
  const segments = [];
  const line = (a, b, style = "single") => segments.push({ points: [a, b], style });
  const addBlock = (center) => {
    const cornerAngle = Math.atan2(midpoint[0] - center[0], midpoint[1] - center[1]);
    const corners = [0, 1, 2, 3].map((index) => {
      const angle = cornerAngle + index * Math.PI / 2;
      return [
        center[0] + Math.sin(angle) * halfDiagonal,
        center[1] + Math.cos(angle) * halfDiagonal,
      ];
    });
    const base = corners.map((corner) => [corner[0], corner[1], 0]);
    const top = corners.map((corner) => [corner[0], corner[1], shaftTopZ]);
    const apex = [center[0], center[1], pyramidTopZ];
    for (let index = 0; index < 4; index++) {
      const next = (index + 1) % 4;
      line(base[index], base[next]);
      line(top[index], top[next]);
      line(base[index], top[index]);
      line(top[index], apex);
    }
  };
  addBlock(nw);
  addBlock(ne);
  addBlock(south);
  return { name: "Portofino Tower", color: colorForName("Portofino Tower (NW)"), segments };
}

function createStephenPClarkGovernmentCenterWireframe(landmarks) {
  const eastPoint = landmarks.find((landmark) => landmark.name === "Stephen P. Clark Government Center (E)")?.xyz;
  if (!eastPoint) return null;
  const width = 64;
  const height = 32;
  const sideLength = 4;
  const cut = (height - sideLength) / 2;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const orientationDeg = 355;
  const angle = ((360 - orientationDeg) % 360) * Math.PI / 180;
  const east = [Math.cos(angle), -Math.sin(angle)];
  const north = [Math.sin(angle), Math.cos(angle)];
  const center = [
    eastPoint[0] - east[0] * halfWidth,
    eastPoint[1] - east[1] * halfWidth,
  ];
  const footprint = [
    [halfWidth - cut, halfHeight],
    [halfWidth, sideLength / 2],
    [halfWidth, -sideLength / 2],
    [halfWidth - cut, -halfHeight],
    [-halfWidth + cut, -halfHeight],
    [-halfWidth, -sideLength / 2],
    [-halfWidth, sideLength / 2],
    [-halfWidth + cut, halfHeight],
  ];
  const point = ([x, y], z) => [
    center[0] + east[0] * x + north[0] * y,
    center[1] + east[1] * x + north[1] * y,
    z,
  ];
  const top = footprint.map((local) => point(local, eastPoint[2]));
  const bottom = footprint.map((local) => point(local, 0));
  const segments = [];
  const line = (a, b, style = "single") => segments.push({ points: [a, b], style });
  for (let index = 0; index < footprint.length; index++) {
    const next = (index + 1) % footprint.length;
    line(bottom[index], bottom[next]);
    line(top[index], top[next]);
    line(bottom[index], top[index]);
  }
  for (let floor = 1; floor <= 36; floor++) {
    const z = floor * 4;
    for (const [a, b] of [[1, 2], [3, 4], [5, 6], [7, 0]]) {
      line(point(footprint[a], z), point(footprint[b], z));
    }
  }
  return {
    name: "Stephen P. Clark Government Center",
    color: colorForName("Stephen P. Clark Government Center (E)"),
    segments,
  };
}

function createFaaMiamiAtctWireframe(landmarks) {
  const center = landmarks.find((landmark) => landmark.name === "FAA Miami ATCT (MIA)")?.xyz;
  if (!center) return null;
  const topZ = center[2];
  const angles = Array.from({ length: 24 }, (_, index) => index * 15);
  const levels = [
    { z: 5, radius: 6 },
    { z: topZ * 0.75, radius: 6 },
    { z: topZ * 0.8125, radius: 9 },
    { z: topZ * 0.875, radius: 9 },
    { z: topZ * 0.875, radius: 6 },
    { z: topZ * 0.9375, radius: 6 },
    { z: topZ * 0.9375, radius: 3 },
    { z: topZ * 0.96875, radius: 3 },
    { z: topZ * 0.96875, radius: 1.5 },
    { z: topZ, radius: 1.5 },
  ];
  const segments = [];
  const point = (angleDeg, radius, z) => {
    const angle = angleDeg * Math.PI / 180;
    return [
      center[0] + Math.sin(angle) * radius,
      center[1] + Math.cos(angle) * radius,
      z,
    ];
  };
  const line = (a, b, style = "single") => segments.push({ points: [a, b], style });
  for (const level of levels) {
    const points = angles.map((angle) => point(angle, level.radius, level.z));
    for (let index = 0; index < points.length; index++) {
      line(points[index], points[(index + 1) % points.length]);
    }
  }
  for (let levelIndex = 0; levelIndex < levels.length - 1; levelIndex++) {
    const lower = levels[levelIndex];
    const upper = levels[levelIndex + 1];
    for (const angle of angles) {
      line(point(angle, lower.radius, lower.z), point(angle, upper.radius, upper.z));
    }
  }
  return { name: "FAA Miami ATCT (MIA)", color: colorForName("FAA Miami ATCT (MIA)"), segments };
}

function createJasonWireframe(cameras) {
  const center = cameras.find((camera) => camera.name === "House with Boat (X)")?.player;
  if (!center) return null;
  const segments = [];
  const radialSegments = 36;
  const bodyRadius = 0.2;
  const feetZ = center[2] - 1.0;
  const shoulderZ = center[2] + 0.6;
  const topZ = center[2] + 0.8;
  const line = (a, b, style = "single") => segments.push({ points: [a, b], style });
  const point = (angle, radius, z) => [
    center[0] + Math.sin(angle) * radius,
    center[1] + Math.cos(angle) * radius,
    z,
  ];
  const ring = (radius, z) => Array.from({ length: radialSegments }, (_, index) => (
    point(index * Math.PI * 2 / radialSegments, radius, z)
  ));
  const rings = [
    ring(bodyRadius, feetZ),
    ring(bodyRadius, shoulderZ),
    ...Array.from({ length: 9 }, (_, index) => {
      const capAngle = (index + 1) * 10 * Math.PI / 180;
      return ring(bodyRadius * Math.cos(capAngle), shoulderZ + (topZ - shoulderZ) * Math.sin(capAngle));
    }),
  ];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex++) {
    for (let index = 0; index < radialSegments; index++) {
      line(rings[ringIndex][index], rings[ringIndex + 1][index]);
    }
  }
  return { name: "Jason", color: colorForName("Jason"), segments };
}

function drawOverlay(matrix) {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.save();
  ctx.font = state.useMonospaceFont
    ? '11px "GTAMapLib Menlo", Menlo, Monaco, Consolas, monospace'
    : "11px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
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
  gl.clearColor(...DAY_SKY_COLOR);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.lineWidth(1);
  const matrix = viewProjection();
  gl.disable(gl.DEPTH_TEST);
  drawWaterPlane(matrix);
  for (const tile of state.tiles) drawTile(tile, matrix);
  for (const wireframe of state.wireframes.filter((item) => item.faces?.length)) {
    const triangles = wireframeFaceTriangles(wireframe);
    const color = wireframe.color || [1.0, 1.0, 1.0];
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    drawSolidTriangles(triangles, [...(wireframe.faceColor || color), 1], matrix);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.DEPTH_TEST);
  }
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  for (const camera of state.cameras) drawCameraThumbnail(camera, matrix);
  const lineGroups = [];
  for (const landmark of state.landmarks) {
    if (landmark.name === "WDNA FM") continue;
    const line = landmarkDropLine(landmark);
    if (line.length) {
      lineGroups.push([thickenLines(line, [0, 0.16]), [...colorForName(landmark.name), 0.34]]);
    }
  }
  for (const camera of state.cameras) {
    const lines = cameraConeLines(camera);
    if (lines.length) lineGroups.push([lines, [...colorForName(camera.name), 0.72]]);
  }
  for (const wireframe of state.wireframes) {
    if (wireframe.faces?.length) continue;
    const groups = wireframeLines(wireframe);
    const color = wireframe.color || [1.0, 0.92, 0.34];
    if (groups.single.length) lineGroups.push([groups.single, [...color, 0.86]]);
    if (groups.thin.length) lineGroups.push([thickenLines(groups.thin, [0, 0.18, -0.18, 0.36]), [...color, 0.78]]);
    if (groups.bold.length) lineGroups.push([thickenLines(groups.bold, [0, 0.18, -0.18, 0.36, -0.36, 0.54]), [...color, 0.92]]);
    if (groups.verticalBold.length) lineGroups.push([thickenVerticalWireframeLines(groups.verticalBold), [...color, 0.94]]);
    if (groups.pillar.length) lineGroups.push([thickenPillarLines(groups.pillar), [...color, 0.94]]);
  }
  for (const [lines, color] of lineGroups) drawLines(lines, color, matrix);
  for (const wireframe of state.wireframes.filter((item) => item.faces?.length)) {
    const groups = wireframeLines(wireframe);
    const color = wireframe.color || [1.0, 1.0, 1.0];
    gl.enable(gl.DEPTH_TEST);
    if (groups.single.length) drawLines(groups.single, [...color, 1], matrix);
    if (groups.thin.length) drawLines(thickenLines(groups.thin, [0, 0.18, -0.18, 0.36]), [...color, 1], matrix);
    if (groups.bold.length) drawLines(thickenLines(groups.bold, [0, 0.18, -0.18, 0.36, -0.36, 0.54]), [...color, 1], matrix);
    if (groups.verticalBold.length) drawLines(thickenVerticalWireframeLines(groups.verticalBold), [...color, 1], matrix);
    if (groups.pillar.length) drawLines(thickenPillarLines(groups.pillar), [...color, 1], matrix);
    gl.disable(gl.DEPTH_TEST);
  }
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
  clampTargetRadius();
}

function clampTargetRadius() {
  const radius = Math.hypot(state.target[0], state.target[2]);
  if (radius <= MAX_TARGET_RADIUS) return;
  const scale = MAX_TARGET_RADIUS / radius;
  state.target[0] *= scale;
  state.target[2] *= scale;
}

function constrainedValue(current, next, min, max) {
  if (current < min) return next < current ? current : Math.min(next, max);
  if (current > max) return next > current ? current : Math.max(next, min);
  return Math.max(min, Math.min(max, next));
}

function navigationEyeAllowed(previousY, nextY) {
  if (previousY < MIN_NAVIGATION_EYE_Y) return nextY >= previousY;
  return nextY >= MIN_NAVIGATION_EYE_Y;
}

function applyNavigationChange(change, clearScreenshot = true) {
  const previous = {
    target: [...state.target],
    distance: state.distance,
    yaw: state.yaw,
    pitch: state.pitch,
  };
  const previousY = cameraEye()[1];
  change();
  if (navigationEyeAllowed(previousY, cameraEye()[1])) {
    if (clearScreenshot) clearActiveScreenshotCamera();
    return true;
  }
  state.target = previous.target;
  state.distance = previous.distance;
  state.yaw = previous.yaw;
  state.pitch = previous.pitch;
  return false;
}

function resetView() {
  stopTour();
  clearActiveScreenshotCamera();
  state.target = [0, 0, 0];
  state.distance = 9800;
  state.yaw = -0.72;
  state.pitch = 0.92;
  state.vfov = 45;
  render();
}

function zoomBy(factor) {
  if (applyNavigationChange(() => {
    state.distance = constrainedValue(state.distance, state.distance * factor, MIN_DISTANCE, 50000);
  })) {
    render();
  }
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
  if (applyNavigationChange(() => {
    state.distance = constrainedValue(state.distance, state.distance * factor, MIN_DISTANCE, 50000);
    if (before) {
      const after = groundPointUnderClient(clientX, clientY);
      if (after) {
        state.target = add(state.target, subtract(before, after));
        clampTargetRadius();
      }
    }
  })) {
    render();
  }
}

function updateControls() {
  state.controlsRaf = null;
  if (root.hidden) return;
  if (state.tour.active) {
    startControlsFrame();
    return;
  }
  const move = state.distance * 0.01;
  let dirty = false;
  const changed = applyNavigationChange(() => {
    if (state.keys.has("w") || state.keys.has("W")) { panBy(0, -move); dirty = true; }
    if (state.keys.has("s") || state.keys.has("S")) { panBy(0, move); dirty = true; }
    if (state.keys.has("a") || state.keys.has("A")) { panBy(-move, 0); dirty = true; }
    if (state.keys.has("d") || state.keys.has("D")) { panBy(move, 0); dirty = true; }
    if (state.keys.has("q") || state.keys.has("Q")) { state.target[1] -= move; dirty = true; }
    if (state.keys.has("e") || state.keys.has("E")) { state.target[1] += move; dirty = true; }
    if (state.keys.has("ArrowLeft")) { state.yaw += 0.025; dirty = true; }
    if (state.keys.has("ArrowRight")) { state.yaw -= 0.025; dirty = true; }
    if (state.keys.has("ArrowUp")) { state.pitch = constrainedValue(state.pitch, state.pitch - 0.018, MIN_PITCH, MAX_PITCH); dirty = true; }
    if (state.keys.has("ArrowDown")) { state.pitch = constrainedValue(state.pitch, state.pitch + 0.018, MIN_PITCH, MAX_PITCH); dirty = true; }
  }, false);
  if (dirty && changed) {
    clearActiveScreenshotCamera();
    render();
  }
  startControlsFrame();
}

function installControls() {
  scene.tabIndex = 0;
  tourStartButton.addEventListener("click", (event) => {
    startTour(event.altKey ? "custom" : event.shiftKey ? "four-seasons" : "screenshots");
  });
  tourBackButton.addEventListener("click", backTour);
  tourPauseButton.addEventListener("click", toggleTour);
  tourForwardButton.addEventListener("click", forwardTour);
  tourStopButton.addEventListener("click", stopTour);
  resetButton.addEventListener("click", resetView);
  exitButton.addEventListener("click", () => {
    if (exitHandler) exitHandler();
  });
  if (gameButton) {
    gameButton.addEventListener("click", (event) => {
      if (event.shiftKey) {
        writeGameSpawnFromCurrentView();
        suspendMap3d();
        window.location.replace("/game");
        return;
      }
      animateToView(gameStartView(), () => {
        suspendMap3d();
        window.location.replace("/game");
      });
    });
  }
  scene.addEventListener("mousedown", (event) => {
    scene.focus();
    if (state.tour.active) return;
    state.dragging = true;
    state.dragMoved = false;
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.dragGroundPoint = groundPointUnderClient(event.clientX, event.clientY);
    state.clickCamera = cameraThumbnailAtClient(event.clientX, event.clientY);
  });
  window.addEventListener("mouseup", (event) => {
    if (!state.tour.active && state.dragging && !state.dragMoved && state.clickCamera) {
      const camera = cameraThumbnailAtClient(event.clientX, event.clientY);
      if (camera === state.clickCamera) {
        stopTour();
        applyTourView(viewForCamera(camera), camera);
      }
    }
    state.dragging = null;
    state.dragMoved = false;
    state.dragGroundPoint = null;
    state.clickCamera = null;
  });
  window.addEventListener("mousemove", (event) => {
    if (!state.dragging) return;
    if (!state.dragMoved) {
      const total = Math.hypot(event.clientX - state.dragStartX, event.clientY - state.dragStartY);
      if (total <= CLICK_MOVE_TOLERANCE) return;
      state.dragMoved = true;
      state.clickCamera = null;
      clearActiveScreenshotCamera();
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      state.dragGroundPoint = groundPointUnderClient(event.clientX, event.clientY);
      return;
    }
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    if (event.metaKey || event.ctrlKey) {
      applyNavigationChange(() => {
        state.yaw -= dx * 0.006;
        state.pitch = constrainedValue(state.pitch, state.pitch + dy * 0.004, MIN_PITCH, MAX_PITCH);
        state.dragGroundPoint = groundPointUnderClient(event.clientX, event.clientY);
      });
    } else {
      applyNavigationChange(() => {
        const current = state.dragGroundPoint ? groundPointUnderClient(event.clientX, event.clientY) : null;
        if (current) {
          state.target = add(state.target, subtract(state.dragGroundPoint, current));
          clampTargetRadius();
        } else {
          const scale = state.distance / Math.max(state.width, state.height);
          panBy(-dx * scale * 1.6, -dy * scale * 1.6);
        }
      });
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
  startControlsFrame();
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
  data.cameras.forEach((camera, index) => {
    camera.map3dOrder = index;
  });
  state.cameras = data.cameras.filter(isDisplayCamera);
  state.landmarks = data.landmarks.filter((landmark) => landmark.xyz);
  const colors = await loadJson(GTAMAPLIB_COLORS);
  if (colors.schema === "gtamaplibvc-map3d-colors-v1") {
    for (const [name, color] of Object.entries(colors.colors || {})) {
      state.colors.set(name, color);
    }
  }
  const wdnaFm = createWdnaFmWireframe(state.landmarks);
  if (wdnaFm) state.wireframes.push(wdnaFm);
  const sefc = createSefcTemporaryWireframe(state.landmarks, { orientationDeg: 10 });
  if (sefc) state.wireframes.push(sefc);
  const operaTower = createOperaTowerWireframe(state.landmarks);
  if (operaTower) state.wireframes.push(operaTower);
  const portofinoTower = createPortofinoTowerWireframe(state.landmarks);
  if (portofinoTower) state.wireframes.push(portofinoTower);
  const stephenPClarkGovernmentCenter = createStephenPClarkGovernmentCenterWireframe(state.landmarks);
  if (stephenPClarkGovernmentCenter) state.wireframes.push(stephenPClarkGovernmentCenter);
  const faaMiamiAtct = createFaaMiamiAtctWireframe(state.landmarks);
  if (faaMiamiAtct) state.wireframes.push(faaMiamiAtct);
  const jason = createJasonWireframe(state.cameras);
  if (jason) state.wireframes.push(jason);
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
      sunshineSkyway.name = "Sunshine Skyway Bridge";
      sunshineSkyway.color = colorForName("Sunshine Skyway Bridge");
      state.wireframes.push(sunshineSkyway);
    }
  } catch (_error) {
    // Optional helper geometry.
  }
  try {
    const homesteadWaterTower = await loadJson(HOMESTEAD_WATER_TOWER_WIREFRAME);
    if (homesteadWaterTower.schema === "gtamaplibvc-map3d-homestead-water-tower-v1") {
      homesteadWaterTower.name = "Homestead Water Tower";
      homesteadWaterTower.color = colorForName("Homestead Water Tower");
      state.wireframes.push(homesteadWaterTower);
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
  startControlsFrame();
  return init().then(() => {
    resize();
    if (Object.hasOwn(options, "initialView")) {
      if (!applyInitialView(options.initialView)) resetView();
    } else {
      applyStoredPose();
    }
    render();
    scene.focus();
  }).catch((error) => {
    viewDataEl.textContent = error.message;
    console.error(error);
  });
}

export function setMap3dSettings(options = {}) {
  if (Object.hasOwn(options, "blurLeaks")) state.blurLeaks = Boolean(options.blurLeaks);
  if (Object.hasOwn(options, "useMonospaceFont")) state.useMonospaceFont = Boolean(options.useMonospaceFont);
  if (!root.hidden) render();
}

export function deactivateMap3d() {
  suspendMap3d();
  root.hidden = true;
}

export function getMap3dTransitionState() {
  if (root.hidden) return null;
  if (state.activeScreenshotCamera?.name) {
    return {
      type: "camera",
      cameraName: state.activeScreenshotCamera.name,
    };
  }
  return currentMapSnapshot();
}
