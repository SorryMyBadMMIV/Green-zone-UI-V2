import { useEffect } from 'react';
import { Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { COLORS, POLICY_RADIUS_M } from '../../lib/constants.js';

const EARTH_CIRCUMFERENCE_M = 40075016.686;

/** Map pixels for `metres` at a latitude and zoom (Web Mercator). */
const metresToPixels = (metres, lat, zoom) => (metres * 256 * 2 ** zoom) / (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180));

const ringsOf = (geometry) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).flat();

/** A canvas layer that shades the district, then cuts a 400 m hole around every park: what is left is not covered. */
function createShadeLayer(focus, parks, pane) {
  const rings = ringsOf(focus);
  const Shade = L.GridLayer.extend({
    createTile(coords) {
      const size = this.getTileSize();
      const tile = document.createElement('canvas');
      tile.width = size.x;
      tile.height = size.y;
      const ctx = tile.getContext('2d');
      const origin = coords.scaleBy(size);
      const project = ([lng, lat]) => this._map.project([lat, lng], coords.z).subtract(origin);
      ctx.fillStyle = COLORS.policyShade;
      ctx.beginPath();
      for (const ring of rings) {
        ring.forEach((point, i) => {
          const { x, y } = project(point);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill('evenodd');
      ctx.globalCompositeOperation = 'destination-out';
      for (const park of parks) {
        const { x, y } = project(park.lngLat);
        const r = metresToPixels(POLICY_RADIUS_M, park.lngLat[1], coords.z);
        if (x + r < 0 || y + r < 0 || x - r > size.x || y - r > size.y) continue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
      }
      return tile;
    },
  });
  return new Shade({ pane, bounds: L.geoJSON(focus).getBounds(), updateWhenZooming: false });
}

function ShadeLayer({ focus, parks, pane }) {
  const map = useMap();
  useEffect(() => {
    const layer = createShadeLayer(focus, parks, pane).addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, focus, parks, pane]);
  return null;
}

/** The 400 m ring around every park and a light shade on district land outside all rings. */
export default function PolicyLayer({ focus, parks, pane }) {
  return (
    <>
      <ShadeLayer focus={focus} parks={parks} pane={pane} />
      {parks.map((park) => (
        <Circle
          key={park.id}
          center={[park.lngLat[1], park.lngLat[0]]}
          radius={POLICY_RADIUS_M}
          pane={pane}
          pathOptions={{ color: COLORS.policyRing, weight: 1.5, opacity: 0.9, dashArray: '3 5', fill: false }}
          interactive={false}
        />
      ))}
    </>
  );
}
