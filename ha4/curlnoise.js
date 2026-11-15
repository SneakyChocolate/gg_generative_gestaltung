// Curl-Noise Helfer für three.js
// Quelle: Bridson, Hourihan, Nordenstam (2007): "Curl-Noise for Procedural Fluid Flow", SIGGRAPH.
// Idee: Geschwindigkeit = Curl eines Potentials -> divergenzfrei (inkompressibel), keine Senken.

import { Vector2, Vector3 } from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

const perlin = new ImprovedNoise();
const CURL_EPS = 1e-3;
const NOISE_OFFSET_Y = 31.416;
const NOISE_OFFSET_Z = 47.853;

export function ramp(r) {
  if (r >= 1) return 1;
  if (r <= -1) return -1;
  return (15 / 8) * r - (10 / 8) * r ** 3 + (3 / 8) * r ** 5;
}

export function noiseSigned(x, y, z) {
  return perlin.noise(x, y, z);
}

export function noisePotential2D(scale, t = 0) {
  return (x, y) => noiseSigned(x * scale, y * scale, t);
}

export function noisePotential3D(scale, t = 0) {
  return (x, y, z) => {
    const sx = x * scale + t;
    const sy = y * scale;
    const sz = z * scale;
    return [
      noiseSigned(sx, sy, sz),
      noiseSigned(sx + NOISE_OFFSET_Y, sy, sz),
      noiseSigned(sx + NOISE_OFFSET_Z, sy, sz),
    ];
  };
}

export function curl2D(psi, x, y, out = new Vector2()) {
  const dx = psi(x + CURL_EPS, y) - psi(x - CURL_EPS, y);
  const dy = psi(x, y + CURL_EPS) - psi(x, y - CURL_EPS);
  const k = 1 / (2 * CURL_EPS);
  return out.set(dy * k, -dx * k);
}

export function curl3D(psi, x, y, z, out = new Vector3()) {
  const xp = psi(x + CURL_EPS, y, z), xm = psi(x - CURL_EPS, y, z);
  const yp = psi(x, y + CURL_EPS, z), ym = psi(x, y - CURL_EPS, z);
  const zp = psi(x, y, z + CURL_EPS), zm = psi(x, y, z - CURL_EPS);
  const k = 1 / (2 * CURL_EPS);
  return out.set(
    (yp[2] - ym[2] - (zp[1] - zm[1])) * k,
    (zp[0] - zm[0] - (xp[2] - xm[2])) * k,
    (xp[1] - xm[1] - (yp[0] - ym[0])) * k
  );
}

export function modulate(psi, amplitude) {
  return (x, y, z) => {
    const a = amplitude(x, y, z);
    const p = psi(x, y, z);
    return Array.isArray(p) ? p.map(v => v * a) : p * a;
  };
}

export function constrainToBoundary(psi, distance, d0) {
  return modulate(psi, (x, y, z) => ramp(distance(x, y, z) / d0));
}

export function circleDistance(cx, cy, radius) {
  return (x, y) => Math.hypot(x - cx, y - cy) - radius;
}

export function sphereDistance(cx, cy, cz, radius) {
  return (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - radius;
}

export function vortexFalloff(r) {
  return r >= 1 ? 0 : 1 - 3 * r * r + 2 * r ** 3;
}

export function vortexPotential2D(cx, cy, omega, radius) {
  return (x, y) => {
    const d2 = (x - cx) ** 2 + (y - cy) ** 2;
    const r = Math.sqrt(d2) / radius;
    return vortexFalloff(r) * ((radius * radius - d2) / 2) * omega;
  };
}

export function addPotentials(...psis) {
  return (x, y, z) => {
    const first = psis[0](x, y, z);
    if (!Array.isArray(first)) return psis.reduce((s, p) => s + p(x, y, z), 0);
    return psis.reduce((s, p) => {
      const v = p(x, y, z);
      return [s[0] + v[0], s[1] + v[1], s[2] + v[2]];
    }, [0, 0, 0]);
  };
}
