import * as THREE from 'three';
import { COLORS } from '../config.js';
import { clamp } from '../utils.js';
import { smoothGeometryNormals, fixDegenerateNormals } from './topology.js';

// Echter Mesh-Schnitt an einer Ebene, inklusive geschlossener Deckflaechen.

export const SLICE_EPS = 1e-5;

function slicePolygon(poly, distances, keepPositive) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const da = distances[i];
    const db = distances[(i + 1) % n];
    const aInside = keepPositive ? da >= -SLICE_EPS : da <= SLICE_EPS;
    const bInside = keepPositive ? db >= -SLICE_EPS : db <= SLICE_EPS;

    if (aInside) out.push(a);
    if (aInside !== bInside) {
      const t = clamp(da / (da - db || 1e-9), 0, 1);
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t,
        cut: true,
      });
    }
  }

  // Direkt aufeinanderliegende Punkte entfernen (haelt die Ringverkettung
  // stabil, wenn ein Vertex exakt auf der Schnittebene liegt).
  const clean = [];
  for (const point of out) {
    const last = clean[clean.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y, point.z - last.z) < 1e-7) continue;
    clean.push(point);
  }
  if (clean.length > 1) {
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z) < 1e-7) clean.pop();
  }
  return clean;
}

function appendSlicePolygon(side, poly) {
  if (poly.length < 3) return;
  for (let i = 1; i < poly.length - 1; i++) {
    const a = poly[0];
    const b = poly[i];
    const c = poly[i + 1];
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-10) continue;
    side.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    side.colors.push(a.r, a.g, a.b, b.r, b.g, b.b, c.r, c.g, c.b);
  }

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (!a.cut || !b.cut) continue;
    if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < 1e-6) continue;
    side.segments.push([a, b]);
  }
}

export function sliceGeometry(geometry, planeNormal, planeConstant) {
  const position = geometry.attributes.position.array;
  const color = geometry.attributes.color ? geometry.attributes.color.array : null;
  const result = {
    positive: { positions: [], colors: [], segments: [] },
    negative: { positions: [], colors: [], segments: [] },
  };

  for (let i = 0; i < position.length; i += 9) {
    const poly = [];
    const distances = [];
    for (let v = 0; v < 3; v++) {
      const ix = i + v * 3;
      const point = {
        x: position[ix],
        y: position[ix + 1],
        z: position[ix + 2],
        r: color ? color[ix] : COLORS.waxCold[0],
        g: color ? color[ix + 1] : COLORS.waxCold[1],
        b: color ? color[ix + 2] : COLORS.waxCold[2],
        cut: false,
      };
      const distance = planeNormal.x * point.x + planeNormal.y * point.y +
        planeNormal.z * point.z - planeConstant;
      point.cut = Math.abs(distance) < SLICE_EPS;
      poly.push(point);
      distances.push(distance);
    }

    let hasPositive = false;
    let hasNegative = false;
    for (const distance of distances) {
      if (distance > SLICE_EPS) hasPositive = true;
      if (distance < -SLICE_EPS) hasNegative = true;
    }

    if (!hasPositive) {
      appendSlicePolygon(result.negative, poly);
    } else if (!hasNegative) {
      appendSlicePolygon(result.positive, poly);
    } else {
      appendSlicePolygon(result.positive, slicePolygon(poly, distances, true));
      appendSlicePolygon(result.negative, slicePolygon(poly, distances, false));
    }
  }

  return result;
}

// Schnittkanten zu Ringen verbinden und jeden Ring mit einem flachen
// Wax-Deckel schliessen. Die Deckflaeche ist absichtlich etwas dunkler,
// damit die Bruchstelle als Materialquerschnitt lesbar bleibt.
export function buildSliceCaps(segments, desiredNormal) {
  const positions = [];
  const colors = [];
  if (!segments.length) return { positions, colors };

  const quant = 10000;
  const keyOf = (point) => `${Math.round(point.x * quant)}|${Math.round(point.y * quant)}|${Math.round(point.z * quant)}`;
  const adjacency = new Map();
  for (let i = 0; i < segments.length; i++) {
    for (const point of segments[i]) {
      const key = keyOf(point);
      if (!adjacency.has(key)) adjacency.set(key, []);
      adjacency.get(key).push(i);
    }
  }

  const used = new Uint8Array(segments.length);
  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const start = segments[s][0];
    const second = segments[s][1];
    const loop = [start, second];
    const startKey = keyOf(start);
    let endKey = keyOf(second);
    let guard = 0;

    while (endKey !== startKey && guard++ < segments.length + 2) {
      const candidates = adjacency.get(endKey);
      if (!candidates) break;
      let nextIndex = -1;
      for (const index of candidates) {
        if (used[index]) continue;
        nextIndex = index;
        break;
      }
      if (nextIndex < 0) break;
      used[nextIndex] = 1;
      const segment = segments[nextIndex];
      const next = keyOf(segment[0]) === endKey ? segment[1] : segment[0];
      loop.push(next);
      endKey = keyOf(next);
    }

    if (loop.length < 3) continue;

    let cx = 0, cy = 0, cz = 0;
    let cr = 0, cg = 0, cb = 0;
    for (const point of loop) {
      cx += point.x; cy += point.y; cz += point.z;
      cr += point.r; cg += point.g; cb += point.b;
    }
    const inverse = 1 / loop.length;
    cx *= inverse; cy *= inverse; cz *= inverse;
    cr = clamp(cr * inverse * 0.88, 0, 1);
    cg = clamp(cg * inverse * 0.84, 0, 1);
    cb = clamp(cb * inverse * 0.76, 0, 1);

    for (let i = 0; i < loop.length; i++) {
      let a = loop[i];
      let b = loop[(i + 1) % loop.length];
      const ux = a.x - cx, uy = a.y - cy, uz = a.z - cz;
      const vx = b.x - cx, vy = b.y - cy, vz = b.z - cz;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      if (Math.hypot(nx, ny, nz) < 1e-10) continue;
      if (nx * desiredNormal.x + ny * desiredNormal.y + nz * desiredNormal.z < 0) {
        const swap = a;
        a = b;
        b = swap;
      }
      positions.push(cx, cy, cz, a.x, a.y, a.z, b.x, b.y, b.z);
      colors.push(cr, cg, cb, a.r, a.g, a.b, b.r, b.g, b.b);
    }
  }

  return { positions, colors };
}

export function geometryFromArrays(positions, colors) {
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(colors), 3),
  );
  geometry.computeVertexNormals();
  sanitizeGeometryAttributes(geometry);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Nach einem Schnitt koennen durch entartete Dreiecke (Flaeche 0) einzelne
// Werte unbrauchbar werden. Vor dem Hochladen in die GPU werden sie ersetzt,
// damit kein NaN/Inf in den HDR-Puffer und damit in den Bloom-Pass gelangt.
export function sanitizeGeometryAttributes(geometry) {
  const position = geometry.attributes.position;
  if (position) {
    const array = position.array;
    let repaired = 0;
    for (let i = 0; i < array.length; i++) {
      if (!Number.isFinite(array[i])) {
        array[i] = 0;
        repaired++;
      }
    }
    if (repaired) position.needsUpdate = true;
  }
  const color = geometry.attributes.color;
  if (color) {
    const array = color.array;
    let repaired = 0;
    for (let i = 0; i < array.length; i++) {
      if (!Number.isFinite(array[i])) {
        array[i] = 0;
        repaired++;
      }
    }
    if (repaired) color.needsUpdate = true;
  }
  const normal = geometry.attributes.normal;
  if (normal) fixDegenerateNormals(normal.array, normal.count);
  if (normal) normal.needsUpdate = true;
}

export function meshVolume(geometry) {
  const positions = geometry.attributes.position.array;
  let volume = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i], ay = positions[i + 1], az = positions[i + 2];
    const bx = positions[i + 3], by = positions[i + 4], bz = positions[i + 5];
    const cx = positions[i + 6], cy = positions[i + 7], cz = positions[i + 8];
    volume += ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx);
  }
  return Math.abs(volume) / 6;
}
