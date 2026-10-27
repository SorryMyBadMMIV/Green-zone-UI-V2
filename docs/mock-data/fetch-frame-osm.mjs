// One-off: download all OpenStreetMap data inside a box from the OSM API (v0.6).
// The API caps one /map call at 50,000 nodes, so the box is fetched as a grid of tiles.
// Usage: node fetch-frame-osm.mjs --bbox 100.5700,13.8990,100.6170,13.9450 --tiles 3x3 --out frame-raw.json   (gisda_03)
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const [west, south, east, north] = (args.bbox ?? '100.5700,13.8990,100.6170,13.9450').split(',').map(Number);
const [NX, NY] = (args.tiles ?? '3x3').split('x').map(Number);
const OUT = args.out ?? 'frame-raw.json';
const HEADERS = { 'User-Agent': 'GreenLantern-hackathon-mockdata/0.2 (one-off script)', Accept: 'application/json' };

const elements = new Map();
for (let i = 0; i < NX; i++) {
  for (let j = 0; j < NY; j++) {
    const w = west + ((east - west) * i) / NX;
    const e = west + ((east - west) * (i + 1)) / NX;
    const s = south + ((north - south) * j) / NY;
    const n = south + ((north - south) * (j + 1)) / NY;
    const bbox = [w, s, e, n].map((v) => v.toFixed(5)).join(',');
    const res = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) throw new Error(`tile ${i},${j} (${bbox}): HTTP ${res.status} ${await res.text()}`);
    const json = await res.json();
    for (const el of json.elements) elements.set(`${el.type}/${el.id}`, el);
    console.log(`tile ${i},${j}: ${json.elements.length} elements (total unique ${elements.size})`);
  }
}
fs.writeFileSync(OUT, JSON.stringify({ version: '0.6', elements: [...elements.values()] }));
console.log(`saved ${OUT}`);
