// Basis: Daniel Shiffman, Coding Challenge 27 "Fireworks"
// http://codingtra.in
// https://youtu.be/CKeyIbT3vXI
// Portiert nach three.js (3D, Meter und Sekunden), datenorientiert als Struct of Arrays.

import * as THREE from 'three';
import { curl3D } from './curlnoise.js';

const GRAVITY = -9.81;
const FLOW_STRENGTH = 150;
const SMOKE_FLOW_STRENGTH = 400;
const SMOKE_RISE = 1.5;
const SMOKE_ALPHA = 0.08;
const SMOKE_CHANCE_PER_SECOND = 3;
const ROCKET_SMOKE_PER_SECOND = 60;
const SPARK_COUNT = 150;

const flowForce = new THREE.Vector3();
const color = new THREE.Color();
const dir = new THREE.Vector3();
const { randFloat, randFloatSpread } = THREE.MathUtils;

export class ParticlePool {
  constructor(max, drag, material) {
    this.max = max;
    this.drag = drag;
    this.count = 0;
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
    if (this.count >= this.max) return;
    const i = this.count++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.color.set([r, g, b, a], i * 4);
  }

  kill(i) {
    const last = --this.count;
    if (i === last) return;
    this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.color.copyWithin(i * 4, last * 4, last * 4 + 4);
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
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

  upload() {
    this.geometry.setDrawRange(0, this.count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

function emitSmoke(smoke, x, y, z) {
  dir.randomDirection().multiplyScalar(randFloat(0.5, 2));
  smoke.spawn(x, y, z, dir.x, dir.y, dir.z, randFloat(2.5, 4), 0.6, 0.6, 0.6, SMOKE_ALPHA);
}

function explode(sparks, x, y, z) {
  color.setHSL(Math.random(), 1, 0.6);
  for (let n = 0; n < SPARK_COUNT; n++) {
    dir.randomDirection().multiplyScalar(randFloat(20, 60));
    sparks.spawn(x, y, z, dir.x, dir.y, dir.z, randFloat(1.5, 2.5), color.r, color.g, color.b, 1);
  }
}

export function launchRocket(rockets) {
  rockets.spawn(
    randFloatSpread(160), 0, -randFloat(70, 150),
    randFloatSpread(6), randFloat(35, 48), randFloatSpread(6),
    Infinity, 1, 0.9, 0.7, 1
  );
}

export function updateRockets(rockets, sparks, smoke, dt) {
  const { pos, vel } = rockets;
  for (let i = rockets.count - 1; i >= 0; i--) {
    rockets.step(i, 0, GRAVITY, 0, 1, dt);
    const k = i * 3;
    if (Math.random() < ROCKET_SMOKE_PER_SECOND * dt) emitSmoke(smoke, pos[k], pos[k + 1], pos[k + 2]);
    if (vel[k + 1] <= 0) {
      explode(sparks, pos[k], pos[k + 1], pos[k + 2]);
      rockets.kill(i);
    }
  }
}

export function updateSparks(sparks, smoke, flow, dt) {
  const { pos } = sparks;
  const damp = Math.pow(sparks.drag, dt);
  for (let i = sparks.count - 1; i >= 0; i--) {
    const k = i * 3;
    curl3D(flow, pos[k], pos[k + 1], pos[k + 2], flowForce);
    const alive = sparks.step(i, flowForce.x * FLOW_STRENGTH, GRAVITY + flowForce.y * FLOW_STRENGTH, flowForce.z * FLOW_STRENGTH, damp, dt);
    if (Math.random() < SMOKE_CHANCE_PER_SECOND * dt) emitSmoke(smoke, pos[k], pos[k + 1], pos[k + 2]);
    if (alive) sparks.fade(i, 1);
    else sparks.kill(i);
  }
}

export function updateSmoke(smoke, flow, dt) {
  const { pos } = smoke;
  const damp = Math.pow(smoke.drag, dt);
  for (let i = smoke.count - 1; i >= 0; i--) {
    const k = i * 3;
    curl3D(flow, pos[k], pos[k + 1], pos[k + 2], flowForce);
    const alive = smoke.step(i, flowForce.x * SMOKE_FLOW_STRENGTH, SMOKE_RISE + flowForce.y * SMOKE_FLOW_STRENGTH, flowForce.z * SMOKE_FLOW_STRENGTH, damp, dt);
    if (alive) smoke.fade(i, SMOKE_ALPHA);
    else smoke.kill(i);
  }
}
