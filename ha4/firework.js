// Basis: Daniel Shiffman, Coding Challenge 27 "Fireworks"
// http://codingtra.in
// https://youtu.be/CKeyIbT3vXI
// Portiert nach three.js (3D, Meter und Sekunden), datenorientiert als Struct of Arrays.
// Herzkurve: https://mathworld.wolfram.com/HeartCurve.html

import * as THREE from 'three';
import { curl3D } from './curlnoise.js';
import { playExplosion } from './sound.js';

const GRAVITY = -9.81;
const FLOW_STRENGTH = 150;
const SMOKE_FLOW_STRENGTH = 400;
const SMOKE_RISE = 1.5;
const SMOKE_ALPHA = 0.08;
const SMOKE_FADE_IN_SPEED = 8;
const ROCKET_SMOKE_GRAY = 0.15;
const SPARK_SMOKE_TINT = 0.3;
const SMOKE_CHANCE_PER_SECOND = 3;
const ROCKET_SMOKE_PER_SECOND = 60;
const SPARK_COUNT = 150;
const STAR_COUNT = 110;
const HEART_POINTS = 64;
const HEART_LAYERS = [1, 0.55];
const HEART_SPEED = 40;
const SPLIT_CHILDREN = 8;
const SPLIT_SPEED = [12, 26];
const SPLIT_FUSE = [0.7, 1.1];
const CHILD_COUNT = 45;
const CHILD_SPEED = [8, 22];
const CHILD_TRAIL_PER_SECOND = 40;
const ORBIT_RINGS = 4;
const ORBIT_PARTICLES = 36;
const ORBIT_RADIUS = 7;
const ORBIT_RADIUS_STEP = 4;
const ORBIT_SPIN = 5;
const ORBIT_SPIN_STEP = 0.8;
const ORBIT_LIFE = 4;
const ORBIT_GROW_DRAG = 0.3;
const ORBIT_SPIN_DRAG = 0.8;
const ORBIT_GRAVITY_SCALE = 0.15;
const CASCADE_SHARE = 0.12;
const CASCADE_FIRST = [4, 6];
const CASCADE_SECOND = [2, 3];
const CASCADE_SPEED = [45, 70];
const CASCADE_FUSE = [0.35, 0.5];
const CASCADE_FLICKER_MIN = 0.2;
const CASCADE_HUE_STEP = 0.33;
const CASCADE_FINAL_HUE = 0.12;
const CASCADE_FINAL_COUNT = 40;
const CASCADE_FINAL_SPEED = [8, 22];
const CASCADE_TRAIL_PER_SECOND = 60;
const SALVO_SIZE = 3;
const SALVO_SPREAD = 3.5;
const LAUNCH_X_SPREAD = 500;
const LAUNCH_Z = [80, 450];

export const ORBIT_STRIDE = 13;
export const ROCKET_STRIDE = 3;
const KIND_SLOT = 0;
const HUE_SLOT = 1;
const STAGE_SLOT = 2;
const RANDOM_HUE = -1;
const [CX, CY, CZ, UX, UY, UZ, VX, VY, VZ, ANGLE, OMEGA, RADIUS, GROWTH] = Array.from({ length: ORBIT_STRIDE }, (_, n) => n);

export const KIND = { PEONY: 0, HEART: 1, STAR: 2, SPLIT: 3, SPIRAL: 4, CHILD: 5, CASCADE: 6, CASCADE_STAGE: 7 };
const LAUNCH_KINDS = [
  KIND.PEONY,
  // KIND.HEART,
  KIND.STAR,
  KIND.SPLIT,
  // KIND.SPIRAL,
];

const LAUNCH_VY = {
  [KIND.PEONY]: [32, 38],
  [KIND.STAR]: [40, 46],
  [KIND.SPLIT]: [48, 54],
  [KIND.CASCADE]: [56, 62],
};

const flowForce = new THREE.Vector3();
const color = new THREE.Color();
const dir = new THREE.Vector3();
const normal = new THREE.Vector3();
const axisU = new THREE.Vector3();
const axisV = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const { randFloat, randFloatSpread } = THREE.MathUtils;

export class ParticlePool {
  constructor(max, drag, material, stride = 0) {
    this.max = max;
    this.drag = drag;
    this.stride = stride;
    this.count = 0;
    this.extra = new Float32Array(max * stride);
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.color = new Float32Array(max * 4);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.color, 4).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
  }

  spawn(x, y, z, vx, vy, vz, life, r, g, b, a) {
    if (this.count >= this.max) return -1;
    const i = this.count++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.color.set([r, g, b, a], i * 4);
    return i;
  }

  kill(i) {
    const last = --this.count;
    if (i === last) return;
    this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.color.copyWithin(i * 4, last * 4, last * 4 + 4);
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    if (this.stride) this.extra.copyWithin(i * this.stride, last * this.stride, (last + 1) * this.stride);
  }

  step(i, ax, ay, az, damp, dt) {
    const k = i * 3;
    const { pos, vel } = this;
    vel[k] = (vel[k] + ax * dt) * damp;
    vel[k + 1] = (vel[k + 1] + ay * dt) * damp;
    vel[k + 2] = (vel[k + 2] + az * dt) * damp;
    pos[k] += vel[k] * dt;
    pos[k + 1] += vel[k + 1] * dt;
    pos[k + 2] += vel[k + 2] * dt;
    this.life[i] -= dt;
    return this.life[i] > 0;
  }

  fade(i, scale) {
    this.color[i * 4 + 3] = scale * this.life[i] / this.maxLife[i];
  }

  fadeInOut(i, scale) {
    const remaining = this.life[i] / this.maxLife[i];
    const fadeIn = Math.min((1 - remaining) * SMOKE_FADE_IN_SPEED, 1);
    this.color[i * 4 + 3] = scale * fadeIn * remaining * remaining;
  }

  upload() {
    this.geometry.setDrawRange(0, this.count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

function emitSmoke(smoke, x, y, z, r, g, b) {
  dir.randomDirection().multiplyScalar(randFloat(0.5, 2));
  smoke.spawn(x, y, z, dir.x, dir.y, dir.z, randFloat(2.5, 4), r, g, b, 0);
}

function burstSphere(pool, x, y, z, count, [speedMin, speedMax]) {
  for (let n = 0; n < count; n++) {
    dir.randomDirection().multiplyScalar(randFloat(speedMin, speedMax));
    pool.spawn(x, y, z, dir.x, dir.y, dir.z, randFloat(1.5, 2.5), color.r, color.g, color.b, 1);
  }
}

function burstHeart(pool, x, y, z) {
  const yaw = Math.atan2(-x, -z);
  const scale = HEART_SPEED / 16;
  for (let n = 0; n < HEART_POINTS; n++) {
    const t = (n / HEART_POINTS) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    for (const layer of HEART_LAYERS) {
      dir.set(hx, hy, 0).multiplyScalar(scale * layer).applyAxisAngle(UP, yaw);
      pool.spawn(x, y, z, dir.x, dir.y, dir.z, randFloat(2.5, 3), color.r, color.g, color.b, 1);
    }
  }
}

function burstSplit(rockets, x, y, z, hue) {
  for (let n = 0; n < SPLIT_CHILDREN; n++) {
    dir.randomDirection().multiplyScalar(randFloat(...SPLIT_SPEED));
    color.setHSL(hue + randFloatSpread(0.15), 1, 0.6);
    const i = rockets.spawn(x, y, z, dir.x, dir.y, dir.z, randFloat(...SPLIT_FUSE), color.r, color.g, color.b, 1);
    if (i >= 0) rockets.extra[i * ROCKET_STRIDE + KIND_SLOT] = KIND.CHILD;
  }
}

function burstCascade(rockets, x, y, z, [min, max], hue, stage) {
  const count = Math.floor(randFloat(min, max + 1));
  color.setHSL(hue, 1, 0.6);
  for (let n = 0; n < count; n++) {
    dir.randomDirection().multiplyScalar(randFloat(...CASCADE_SPEED));
    const i = rockets.spawn(x, y, z, dir.x, dir.y, dir.z, randFloat(...CASCADE_FUSE), color.r, color.g, color.b, 1);
    if (i < 0) return;
    rockets.extra.set([KIND.CASCADE_STAGE, hue, stage], i * ROCKET_STRIDE);
  }
}

function burstOrbits(orbits, x, y, z, hue) {
  const { extra } = orbits;
  const growthPerRadius = -Math.log(ORBIT_GROW_DRAG);
  for (let ring = 0; ring < ORBIT_RINGS; ring++) {
    color.setHSL((hue + ring * 0.12) % 1, 1, 0.6);
    normal.randomDirection();
    axisU.randomDirection().cross(normal).normalize();
    axisV.crossVectors(normal, axisU);
    const spin = (ring % 2 ? -1 : 1) * (ORBIT_SPIN - ring * ORBIT_SPIN_STEP);
    const growth = (ORBIT_RADIUS + ring * ORBIT_RADIUS_STEP) * growthPerRadius;
    for (let n = 0; n < ORBIT_PARTICLES; n++) {
      const i = orbits.spawn(x, y, z, 0, 0, 0, ORBIT_LIFE, color.r, color.g, color.b, 1);
      if (i < 0) return;
      extra.set([x, y, z, axisU.x, axisU.y, axisU.z, axisV.x, axisV.y, axisV.z, (n / ORBIT_PARTICLES) * Math.PI * 2, spin, 0, growth], i * ORBIT_STRIDE);
    }
  }
}

function explode(pools, rockets, kind, hue, x, y, z) {
  playExplosion(x, y, z);
  color.setHSL(hue, 1, 0.6);
  pools.flash(x, y, z, color);
  if (kind === KIND.PEONY) burstSphere(pools.sparks, x, y, z, SPARK_COUNT, [20, 60]);
  else if (kind === KIND.STAR) burstSphere(pools.stars, x, y, z, STAR_COUNT, [20, 50]);
  else if (kind === KIND.HEART) burstHeart(pools.hearts, x, y, z);
  else if (kind === KIND.SPLIT) burstSplit(rockets, x, y, z, hue);
  else if (kind === KIND.CASCADE) burstCascade(rockets, x, y, z, CASCADE_FIRST, hue, 1);
  else if (kind === KIND.SPIRAL) burstOrbits(pools.orbits, x, y, z, hue);
}

function spawnRocket(rockets, x, z, vx, vy, vz, kind, hue) {
  if (hue === RANDOM_HUE) color.setRGB(1, 0.9, 0.7);
  else color.setHSL(hue, 0.6, 0.8);
  const i = rockets.spawn(x, 0, z, vx, vy, vz, Infinity, color.r, color.g, color.b, 1);
  if (i < 0) return;
  rockets.extra[i * ROCKET_STRIDE + KIND_SLOT] = kind;
  rockets.extra[i * ROCKET_STRIDE + HUE_SLOT] = hue;
}

export function launchRocket(rockets) {
  const kind = Math.random() < CASCADE_SHARE ? KIND.CASCADE : LAUNCH_KINDS[Math.floor(Math.random() * LAUNCH_KINDS.length)];
  spawnRocket(
    rockets,
    randFloatSpread(LAUNCH_X_SPREAD), -randFloat(...LAUNCH_Z),
    randFloatSpread(6), randFloat(...LAUNCH_VY[kind]), randFloatSpread(6),
    kind, RANDOM_HUE
  );
}

export function launchSalvo(rockets) {
  const x = randFloatSpread(LAUNCH_X_SPREAD);
  const z = -randFloat(...LAUNCH_Z);
  const hue = Math.random();
  const phase = Math.random() * Math.PI * 2;
  const kinds = [...LAUNCH_KINDS].sort(() => Math.random() - 0.5);
  for (let n = 0; n < SALVO_SIZE; n++) {
    const angle = phase + (n / SALVO_SIZE) * Math.PI * 2;
    spawnRocket(
      rockets, x, z,
      Math.cos(angle) * SALVO_SPREAD, randFloat(...LAUNCH_VY[kinds[n]]), Math.sin(angle) * SALVO_SPREAD,
      kinds[n], (hue + n / SALVO_SIZE) % 1
    );
  }
}

export function updateRockets(rockets, pools, dt) {
  const { pos, vel, color: rocketColor, extra: kinds } = rockets;
  for (let i = rockets.count - 1; i >= 0; i--) {
    const kind = kinds[i * ROCKET_STRIDE + KIND_SLOT];
    const rocketHue = kinds[i * ROCKET_STRIDE + HUE_SLOT];
    const alive = rockets.step(i, 0, GRAVITY, 0, 1, dt);
    const k = i * 3;
    const c = i * 4;
    const [x, y, z] = [pos[k], pos[k + 1], pos[k + 2]];
    if (kind === KIND.CHILD) {
      if (Math.random() < CHILD_TRAIL_PER_SECOND * dt) pools.sparks.spawn(x, y, z, 0, 0, 0, 0.6, rocketColor[c], rocketColor[c + 1], rocketColor[c + 2], 1);
      if (!alive) {
        color.setRGB(rocketColor[c], rocketColor[c + 1], rocketColor[c + 2]);
        burstSphere(pools.sparks, x, y, z, CHILD_COUNT, CHILD_SPEED);
        rockets.kill(i);
        continue;
      }
    }
    if (kind === KIND.CASCADE || kind === KIND.CASCADE_STAGE) {
      rocketColor[c + 3] = randFloat(CASCADE_FLICKER_MIN, 1);
      if (Math.random() < CASCADE_TRAIL_PER_SECOND * dt) pools.sparks.spawn(x, y, z, 0, 0, 0, 0.5, rocketColor[c], rocketColor[c + 1], rocketColor[c + 2], 1);
    }
    if (kind === KIND.CASCADE_STAGE && !alive) {
      const stage = kinds[i * ROCKET_STRIDE + STAGE_SLOT];
      if (stage === 1) burstCascade(rockets, x, y, z, CASCADE_SECOND, (rocketHue + CASCADE_HUE_STEP) % 1, 2);
      else {
        playExplosion(x, y, z);
        color.setHSL(CASCADE_FINAL_HUE, 1, 0.6);
        pools.flash(x, y, z, color);
        burstSphere(pools.sparks, x, y, z, CASCADE_FINAL_COUNT, CASCADE_FINAL_SPEED);
      }
      rockets.kill(i);
      continue;
    }
    if (Math.random() < ROCKET_SMOKE_PER_SECOND * dt) emitSmoke(pools.smoke, x, y, z, ROCKET_SMOKE_GRAY, ROCKET_SMOKE_GRAY, ROCKET_SMOKE_GRAY);
    if (kind !== KIND.CHILD && kind !== KIND.CASCADE_STAGE && vel[k + 1] <= 0) {
      explode(pools, rockets, kind, rocketHue === RANDOM_HUE ? Math.random() : rocketHue, x, y, z);
      rockets.kill(i);
    }
  }
}

export function updateSparks(sparks, smoke, flow, dt) {
  const { pos, color } = sparks;
  const damp = Math.pow(sparks.drag, dt);
  for (let i = sparks.count - 1; i >= 0; i--) {
    const k = i * 3;
    curl3D(flow, pos[k], pos[k + 1], pos[k + 2], flowForce);
    const alive = sparks.step(i, flowForce.x * FLOW_STRENGTH, GRAVITY + flowForce.y * FLOW_STRENGTH, flowForce.z * FLOW_STRENGTH, damp, dt);
    if (Math.random() < SMOKE_CHANCE_PER_SECOND * dt) {
      const c = i * 4;
      emitSmoke(smoke, pos[k], pos[k + 1], pos[k + 2], color[c] * SPARK_SMOKE_TINT, color[c + 1] * SPARK_SMOKE_TINT, color[c + 2] * SPARK_SMOKE_TINT);
    }
    if (alive) sparks.fade(i, 1);
    else sparks.kill(i);
  }
}

export function updateOrbits(orbits, smoke, dt) {
  const { pos, vel, extra: e, color } = orbits;
  const growthDamp = Math.pow(ORBIT_GROW_DRAG, dt);
  const spinDamp = Math.pow(ORBIT_SPIN_DRAG, dt);
  for (let i = orbits.count - 1; i >= 0; i--) {
    const k = i * 3;
    const o = i * ORBIT_STRIDE;
    vel[k + 1] += GRAVITY * ORBIT_GRAVITY_SCALE * dt;
    e[o + CY] += vel[k + 1] * dt;
    e[o + RADIUS] += e[o + GROWTH] * dt;
    e[o + GROWTH] *= growthDamp;
    e[o + OMEGA] *= spinDamp;
    e[o + ANGLE] += e[o + OMEGA] * dt;
    const along = Math.cos(e[o + ANGLE]) * e[o + RADIUS];
    const across = Math.sin(e[o + ANGLE]) * e[o + RADIUS];
    pos[k] = e[o + CX] + along * e[o + UX] + across * e[o + VX];
    pos[k + 1] = e[o + CY] + along * e[o + UY] + across * e[o + VY];
    pos[k + 2] = e[o + CZ] + along * e[o + UZ] + across * e[o + VZ];
    orbits.life[i] -= dt;
    if (orbits.life[i] <= 0) {
      orbits.kill(i);
      continue;
    }
    if (Math.random() < SMOKE_CHANCE_PER_SECOND * dt) {
      const c = i * 4;
      emitSmoke(smoke, pos[k], pos[k + 1], pos[k + 2], color[c] * SPARK_SMOKE_TINT, color[c + 1] * SPARK_SMOKE_TINT, color[c + 2] * SPARK_SMOKE_TINT);
    }
    orbits.fade(i, 1);
  }
}

export function updateSmoke(smoke, flow, dt) {
  const { pos } = smoke;
  const damp = Math.pow(smoke.drag, dt);
  for (let i = smoke.count - 1; i >= 0; i--) {
    const k = i * 3;
    curl3D(flow, pos[k], pos[k + 1], pos[k + 2], flowForce);
    const alive = smoke.step(i, flowForce.x * SMOKE_FLOW_STRENGTH, SMOKE_RISE + flowForce.y * SMOKE_FLOW_STRENGTH, flowForce.z * SMOKE_FLOW_STRENGTH, damp, dt);
    if (alive) smoke.fadeInOut(i, SMOKE_ALPHA);
    else smoke.kill(i);
  }
}
