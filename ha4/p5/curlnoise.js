// Curl-Noise Helfer für p5.js
// Quelle: Bridson, Hourihan, Nordenstam (2007): "Curl-Noise for Procedural Fluid Flow", SIGGRAPH.
// Idee: Geschwindigkeit = Curl eines Potentials -> divergenzfrei (inkompressibel), keine Senken.

const CURL_EPS = 1e-3;
const NOISE_OFFSET_Y = 31.416;
const NOISE_OFFSET_Z = 47.853;

function ramp(r) {
  if (r >= 1) return 1;
  if (r <= -1) return -1;
  return (15 / 8) * r - (10 / 8) * r ** 3 + (3 / 8) * r ** 5;
}

function noiseSigned(x, y, z) {
  return noise(x, y, z) * 2 - 1;
}

function noisePotential2D(scale, t = 0) {
  return (x, y) => noiseSigned(x * scale, y * scale, t);
}

function noisePotential3D(scale, t = 0) {
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

function curl2D(psi, x, y, out = createVector()) {
  const dx = psi(x + CURL_EPS, y) - psi(x - CURL_EPS, y);
  const dy = psi(x, y + CURL_EPS) - psi(x, y - CURL_EPS);
  const k = 1 / (2 * CURL_EPS);
  return out.set(dy * k, -dx * k);
}

function curl3D(psi, x, y, z, out = createVector()) {
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

function modulate(psi, amplitude) {
  return (x, y, z) => {
    const a = amplitude(x, y, z);
    const p = psi(x, y, z);
    return Array.isArray(p) ? p.map(v => v * a) : p * a;
  };
}

function constrainToBoundary(psi, distance, d0) {
  return modulate(psi, (x, y, z) => ramp(distance(x, y, z) / d0));
}

function circleDistance(cx, cy, radius) {
  return (x, y) => Math.hypot(x - cx, y - cy) - radius;
}

function sphereDistance(cx, cy, cz, radius) {
  return (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - radius;
}

function vortexFalloff(r) {
  return r >= 1 ? 0 : 1 - 3 * r * r + 2 * r ** 3;
}

function vortexPotential2D(cx, cy, omega, radius) {
  return (x, y) => {
    const d2 = (x - cx) ** 2 + (y - cy) ** 2;
    const r = Math.sqrt(d2) / radius;
    return vortexFalloff(r) * ((radius * radius - d2) / 2) * omega;
  };
}

function addPotentials(...psis) {
  return (x, y, z) => {
    const first = psis[0](x, y, z);
    if (!Array.isArray(first)) return psis.reduce((s, p) => s + p(x, y, z), 0);
    return psis.reduce((s, p) => {
      const v = p(x, y, z);
      return [s[0] + v[0], s[1] + v[1], s[2] + v[2]];
    }, [0, 0, 0]);
  };
}
