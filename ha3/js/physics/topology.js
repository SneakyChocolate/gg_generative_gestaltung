import * as THREE from 'three';

// Verschweisst die Dreiecksecken eines non-indexed Meshes zu logischen
// Vertices und baut Nachbarschaften sowie Ruhekanten auf.

export function buildMeshTopology(geometry) {
  const position = geometry.attributes.position;
  const pos = position.array;
  const count = position.count;
  const keyToUnique = new Map();
  const uniqueOfVertex = new Int32Array(count);
  const uniqueList = [];
  const quant = 10000;

  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    const key = `${Math.round(pos[ix] * quant)}|${Math.round(pos[ix + 1] * quant)}|${Math.round(pos[ix + 2] * quant)}`;
    let unique = keyToUnique.get(key);
    if (unique === undefined) {
      unique = uniqueList.length / 3;
      keyToUnique.set(key, unique);
      uniqueList.push(pos[ix], pos[ix + 1], pos[ix + 2]);
    }
    uniqueOfVertex[i] = unique;
  }

  const uniqueCount = uniqueList.length / 3;
  const uniqueBase = new Float32Array(uniqueList);
  const neighborSets = new Array(uniqueCount);
  for (let i = 0; i < uniqueCount; i++) neighborSets[i] = new Set();

  for (let i = 0; i < count; i += 3) {
    const a = uniqueOfVertex[i];
    const b = uniqueOfVertex[i + 1];
    const c = uniqueOfVertex[i + 2];
    if (a !== b) { neighborSets[a].add(b); neighborSets[b].add(a); }
    if (b !== c) { neighborSets[b].add(c); neighborSets[c].add(b); }
    if (c !== a) { neighborSets[c].add(a); neighborSets[a].add(c); }
  }

  let neighborTotal = 0;
  for (const set of neighborSets) neighborTotal += set.size;
  const neighborStart = new Int32Array(uniqueCount + 1);
  const neighborList = new Int32Array(neighborTotal);
  let cursor = 0;
  for (let u = 0; u < uniqueCount; u++) {
    neighborStart[u] = cursor;
    for (const v of neighborSets[u]) neighborList[cursor++] = v;
  }
  neighborStart[uniqueCount] = cursor;

  const edgeA = [];
  const edgeB = [];
  const edgeRest = [];
  for (let u = 0; u < uniqueCount; u++) {
    for (const v of neighborSets[u]) {
      if (v <= u) continue;
      const dx = uniqueBase[v * 3] - uniqueBase[u * 3];
      const dy = uniqueBase[v * 3 + 1] - uniqueBase[u * 3 + 1];
      const dz = uniqueBase[v * 3 + 2] - uniqueBase[u * 3 + 2];
      edgeA.push(u);
      edgeB.push(v);
      edgeRest.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
  }

  return {
    uniqueCount,
    uniqueOfVertex,
    uniqueBase,
    neighborStart,
    neighborList,
    edgeA: new Int32Array(edgeA),
    edgeB: new Int32Array(edgeB),
    edgeRest: new Float32Array(edgeRest),
  };
}

// Weiche Normalen fuer ein ganzes Mesh. Positionen werden verschweisst,
// damit bevelte Buchstaben nicht in einzelne Dreiecksflaechen zerfallen.
export function smoothGeometryNormals(geometry) {
  const position = geometry.attributes.position;
  const count = position.count;
  if (!geometry.attributes.normal) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  }
  const pos = position.array;
  const out = geometry.attributes.normal.array;
  const topo = buildMeshTopology(geometry);
  const accum = new Float32Array(topo.uniqueCount * 3);

  for (let i = 0; i < count; i += 3) {
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
    const bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
    const cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (let v = 0; v < 3; v++) {
      const unique = topo.uniqueOfVertex[i + v] * 3;
      accum[unique] += nx;
      accum[unique + 1] += ny;
      accum[unique + 2] += nz;
    }
  }

  for (let u = 0; u < topo.uniqueCount; u++) {
    const ix = u * 3;
    const length = Math.hypot(accum[ix], accum[ix + 1], accum[ix + 2]) || 1;
    accum[ix] /= length;
    accum[ix + 1] /= length;
    accum[ix + 2] /= length;
  }

  for (let i = 0; i < count; i++) {
    const unique = topo.uniqueOfVertex[i] * 3;
    const ix = i * 3;
    out[ix] = accum[unique];
    out[ix + 1] = accum[unique + 1];
    out[ix + 2] = accum[unique + 2];
  }
  fixDegenerateNormals(out, count);
  geometry.attributes.normal.needsUpdate = true;
}

// Ein Normalenvektor der Laenge 0 ist in WebGL eine Falle: normalize(0)
// liefert NaN, das Lighting schreibt NaN in den HDR-Puffer und der Bloom-
// Pass verschmiert diese NaN ueber den ganzen Bildschirm (schwarze Frames).
// Deshalb bekommt jeder degenerierte Normal eine sichere Ersatzrichtung.
export function fixDegenerateNormals(normals, count) {
  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    const x = normals[ix];
    const y = normals[ix + 1];
    const z = normals[ix + 2];
    const length = Math.hypot(x, y, z);
    if (!Number.isFinite(length) || length < 1e-6) {
      normals[ix] = 0;
      normals[ix + 1] = 1;
      normals[ix + 2] = 0;
    } else {
      normals[ix] = x / length;
      normals[ix + 1] = y / length;
      normals[ix + 2] = z / length;
    }
  }
}
