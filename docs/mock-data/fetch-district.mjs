// One-off: download a district (an OSM admin_level boundary relation) and its neighbouring districts from the
// OpenStreetMap API (v0.6).
// Usage: node fetch-district.mjs --relation 1639287 --out district-raw.json          (Don Mueang)
//        node fetch-district.mjs --name "Suan Luang District, Bangkok" --out suan-luang-district-raw.json
// --name looks the relation up with Nominatim first.
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const OUT = args.out ?? 'district-raw.json';
const HEADERS = { 'User-Agent': 'GreenLantern-hackathon-mockdata/0.2 (one-off script)', Accept: 'application/json' };

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}
const api = (path) => getJson(`https://api.openstreetmap.org/api/0.6/${path}`);

async function findRelation(query) {
  const results = await getJson(`https://nominatim.openstreetmap.org/search?format=json&limit=10&q=${encodeURIComponent(query)}`);
  const hit = results.find((r) => r.osm_type === 'relation' && (r.type === 'administrative' || r.class === 'boundary'));
  if (!hit) throw new Error(`No administrative relation found for "${query}": ${JSON.stringify(results.map((r) => [r.osm_type, r.type, r.display_name]))}`);
  console.log(`Nominatim: relation ${hit.osm_id} ${hit.display_name}`);
  return Number(hit.osm_id);
}

const relationId = args.relation ? Number(args.relation) : await findRelation(args.name);
if (!relationId) throw new Error('Give --relation <id> or --name "<place>"');

const elements = new Map();
const add = (json) => json.elements.forEach((el) => elements.set(`${el.type}/${el.id}`, el));

const full = await api(`relation/${relationId}/full.json`);
add(full);
const relation = full.elements.find((el) => el.type === 'relation' && el.id === relationId);
console.log('District:', relation.tags.name, relation.tags['name:en'], 'admin_level', relation.tags.admin_level);

// Neighbours = other boundaries of the same admin_level that share a boundary way with it.
const neighbours = new Map();
for (const member of relation.members.filter((m) => m.type === 'way')) {
  const rels = await api(`way/${member.ref}/relations.json`);
  for (const rel of rels.elements) {
    const t = rel.tags ?? {};
    if (rel.id !== relationId && t.boundary === 'administrative' && t.admin_level === relation.tags.admin_level) {
      neighbours.set(rel.id, `${t.name} / ${t['name:en'] ?? ''}`);
    }
  }
}
console.log('Neighbours:', [...neighbours].map(([id, n]) => `${id} ${n}`).join(' | '));

for (const id of neighbours.keys()) add(await api(`relation/${id}/full.json`));
fs.writeFileSync(OUT, JSON.stringify({ version: '0.6', focusRelation: relationId, elements: [...elements.values()] }));
console.log(`saved ${OUT}: ${elements.size} elements; focus ${relationId}; neighbour ids: ${[...neighbours.keys()].join(',')}`);
