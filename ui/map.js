const MAP_W = 32768;
const MAP_H = 32768;
const ZERO_X = 16384;
const ZERO_Y = 16384;
const TILE_SIZE = 256;
const MIN_Z = 0;
const MAX_Z = 6;

const TILE_RANGES = {
  0: [[0, 0], [2, 2]],
  1: [[0, 1], [4, 5]],
  2: [[0, 2], [9, 11]],
  3: [[0, 4], [19, 23]],
  4: [[0, 8], [38, 47]],
  5: [[0, 17], [77, 95]],
  6: [[0, 34], [155, 190]],
};

export class GtaTileMap {
  constructor(options = {}) {
    this.tileRoot = options.tileRoot || "/gtadb.org/maps/tiles/6/yanis,12";
    this.cache = new Map();
    this.pending = new Map();
    this.onLoad = null;
  }

  metersPerPixel(zoom) {
    return MAP_W / (1024 * Math.pow(2, zoom));
  }

  zoomForMetersPerPixel(metersPerPixel) {
    return Math.log2(MAP_W / (1024 * metersPerPixel));
  }

  worldToMapPixel(x, y, zoom) {
    const mapSize = 1024 * Math.pow(2, zoom);
    const mppx = mapSize / MAP_W;
    return {
      x: (x + ZERO_X) * mppx,
      y: (ZERO_Y - y) * mppx,
    };
  }

  mapPixelToWorld(x, y, zoom) {
    const mapSize = 1024 * Math.pow(2, zoom);
    const mppx = mapSize / MAP_W;
    return {
      x: x / mppx - ZERO_X,
      y: ZERO_Y - y / mppx,
    };
  }

  worldToScreen(x, y, view) {
    const point = this.worldToMapPixel(x, y, view.zoom);
    const center = this.worldToMapPixel(view.centerX, view.centerY, view.zoom);
    return {
      x: view.width / 2 + point.x - center.x,
      y: view.height / 2 + point.y - center.y,
    };
  }

  screenToWorld(x, y, view) {
    const center = this.worldToMapPixel(view.centerX, view.centerY, view.zoom);
    return this.mapPixelToWorld(center.x + x - view.width / 2, center.y + y - view.height / 2, view.zoom);
  }

  tileUrl(z, x, y) {
    return `${this.tileRoot}/${z}/${z},${y},${x}.jpg`;
  }

  tileKey(z, x, y) {
    return `${z}/${y}/${x}`;
  }

  getTile(z, x, y) {
    const key = this.tileKey(z, x, y);
    if (this.cache.has(key)) return this.cache.get(key);
    const image = new Image();
    this.cache.set(key, image);
    return image;
  }

  loadTile(z, x, y) {
    const image = this.getTile(z, x, y);
    if (image.src || this.pending.has(this.tileKey(z, x, y))) return image;
    const key = this.tileKey(z, x, y);
    this.pending.set(key, true);
    image.addEventListener("load", () => {
      this.pending.delete(key);
      if (this.onLoad) requestAnimationFrame(this.onLoad);
    }, { once: true });
    image.addEventListener("error", () => {
      this.pending.delete(key);
    }, { once: true });
    image.src = this.tileUrl(z, x, y);
    return image;
  }

  drawParentTile(context, zInt, x, y, tx, ty, drawSize) {
    const maxParentLevels = 2;
    for (let parentZ = zInt - 1; parentZ >= Math.max(MIN_Z, zInt - maxParentLevels); parentZ--) {
      const scale = Math.pow(2, zInt - parentZ);
      const parentX = Math.floor(x / scale);
      const parentY = Math.floor(y / scale);
      const [[x0, y0], [x1, y1]] = TILE_RANGES[parentZ];
      if (parentX < x0 || parentX > x1 || parentY < y0 || parentY > y1) continue;
      const image = this.getTile(parentZ, parentX, parentY);
      if (!image.complete || image.naturalWidth === 0) {
        this.loadTile(parentZ, parentX, parentY);
        continue;
      }
      const sourceSize = TILE_SIZE / scale;
      const sx = (x - parentX * scale) * sourceSize;
      const sy = (y - parentY * scale) * sourceSize;
      this.drawTile(context, image, sx, sy, sourceSize, sourceSize, tx, ty, drawSize);
      return true;
    }
    return false;
  }

  drawTile(context, image, sx, sy, sw, sh, tx, ty, drawSize) {
    const dx = Math.floor(tx);
    const dy = Math.floor(ty);
    const dw = Math.ceil(tx + drawSize) - dx;
    const dh = Math.ceil(ty + drawSize) - dy;
    context.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  render(context, view) {
    const width = Math.max(1, view.width);
    const height = Math.max(1, view.height);
    const zoom = Math.min(MAX_Z, Math.max(MIN_Z, view.zoom));
    const zInt = Math.min(MAX_Z, Math.max(MIN_Z, Math.ceil(zoom)));
    const mapSize = 1024 * Math.pow(2, zoom);
    const mppx = mapSize / MAP_W;
    const centerX = (view.centerX + ZERO_X) * mppx;
    const centerY = (ZERO_Y - view.centerY) * mppx;
    const offsetX = width / 2 - centerX;
    const offsetY = height / 2 - centerY;
    const drawSize = TILE_SIZE * Math.pow(2, zoom - zInt);
    const [[x0, y0], [x1, y1]] = TILE_RANGES[zInt];

    context.save();
    context.imageSmoothingEnabled = true;
    context.filter = view.grayscale ? "grayscale(100%)" : "none";

    const minTx = Math.floor(-offsetX / drawSize);
    const maxTx = Math.ceil((width - offsetX) / drawSize);
    const minTy = Math.floor(-offsetY / drawSize);
    const maxTy = Math.ceil((height - offsetY) / drawSize);
    for (let y = minTy; y <= maxTy; y++) {
      for (let x = minTx; x <= maxTx; x++) {
        const tx = offsetX + x * drawSize;
        const ty = offsetY + y * drawSize;
        if (x < x0 || x > x1 || y < y0 || y > y1) {
          context.clearRect(tx, ty, drawSize, drawSize);
          continue;
        }
        const image = this.loadTile(zInt, x, y);
        if (image.complete && image.naturalWidth > 0) {
          this.drawTile(context, image, 0, 0, TILE_SIZE, TILE_SIZE, tx, ty, drawSize);
        } else {
          this.drawParentTile(context, zInt, x, y, tx, ty, drawSize);
        }
      }
    }

    context.restore();
  }
}
