import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { affineFromPoints } from '../../lib/raster.js';

/** The image as a canvas plus halved copies, used when the map is zoomed out. */
function buildMipmaps(image) {
  const base = document.createElement('canvas');
  base.width = image.width;
  base.height = image.height;
  base.getContext('2d').drawImage(image, 0, 0);
  const levels = [base];
  while (levels.at(-1).width > 32 && levels.at(-1).height > 32) {
    const previous = levels.at(-1);
    const next = document.createElement('canvas');
    next.width = Math.ceil(previous.width / 2);
    next.height = Math.ceil(previous.height / 2);
    next.getContext('2d').drawImage(previous, 0, 0, next.width, next.height);
    levels.push(next);
  }
  return levels;
}

/** Draws `image` mapped from the source triangle onto the tile triangle, grown by 1 px so neighbours meet without a seam. */
function drawTriangle(ctx, image, source, target) {
  const cx = (target[0][0] + target[1][0] + target[2][0]) / 3;
  const cy = (target[0][1] + target[1][1] + target[2][1]) / 3;
  ctx.save();
  ctx.beginPath();
  target.forEach(([x, y], i) => {
    const length = Math.hypot(x - cx, y - cy) || 1;
    const px = x + (x - cx) / length;
    const py = y + (y - cy) / length;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(...affineFromPoints(source, target));
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

/**
 * A Leaflet GridLayer that draws an image over a four-corner frame: row 0 = north edge, column 0 = west edge.
 * Each tile draws the image as two affine triangles, so all four frame corners land exactly.
 * smooth=false keeps one-pixel-per-cell images as crisp squares when zoomed in; smooth=true blends them.
 */
export function createFrameLayer(corners, image, { pane, opacity = 1, smooth = false } = {}) {
  const mipmaps = buildMipmaps(image);
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;
  const points = [topLeft, topRight, bottomRight, bottomLeft].map(([lat, lng]) => L.latLng(lat, lng));

  const FrameImage = L.GridLayer.extend({
    createTile(coords) {
      const size = this.getTileSize();
      const tile = document.createElement('canvas');
      tile.width = size.x;
      tile.height = size.y;
      const origin = coords.scaleBy(size);
      const [tl, tr, br, bl] = points.map((latLng) => {
        const point = this._map.project(latLng, coords.z).subtract(origin);
        return [point.x, point.y];
      });
      // Use the copy whose pixels are closest to the on-screen pixel size.
      const pixelsPerSourcePixel = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]) / image.width;
      const level = Math.max(0, Math.min(mipmaps.length - 1, Math.round(Math.log2(1 / pixelsPerSourcePixel))));
      const copy = mipmaps[level];
      const ctx = tile.getContext('2d');
      ctx.imageSmoothingEnabled = smooth || level > 0 || pixelsPerSourcePixel < 1;
      const [w, h] = [copy.width, copy.height];
      drawTriangle(ctx, copy, [[0, 0], [w, 0], [0, h]], [tl, tr, bl]);
      drawTriangle(ctx, copy, [[w, 0], [w, h], [0, h]], [tr, br, bl]);
      return tile;
    },
  });

  return new FrameImage({ pane, opacity, bounds: L.latLngBounds(points), updateWhenZooming: false });
}

/** An image (a canvas, or a URL that is loaded first) drawn over a frame's four corners. */
export default function FrameImageLayer({ corners, source, pane, opacity = 1, smooth = false }) {
  const map = useMap();
  useEffect(() => {
    let layer = null;
    let cancelled = false;
    const add = (image) => {
      if (cancelled) return;
      layer = createFrameLayer(corners, image, { pane, opacity, smooth });
      layer.addTo(map);
    };
    if (typeof source === 'string') {
      const image = new Image();
      image.onload = () => add(image);
      image.onerror = () => console.error(`Couldn't load the map image ${source}`);
      image.src = source;
    } else {
      add(source);
    }
    return () => {
      cancelled = true;
      layer?.remove();
    };
  }, [map, corners, source, pane, opacity, smooth]);
  return null;
}
