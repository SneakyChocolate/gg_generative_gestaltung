// Basis: Daniel Shiffman, Coding Challenge 27 "Fireworks"
// http://codingtra.in
// https://youtu.be/CKeyIbT3vXI
// Portiert nach three.js (3D, Einheiten in Metern und Sekunden).

import * as THREE from 'three';
import { curl3D } from './curlnoise.js';

const GRAVITY = new THREE.Vector3(0, -9.81, 0);
const FLOW_STRENGTH = 150;
const SMOKE_FLOW_STRENGTH = 400;
const SMOKE_RISE = 1.5;
const SMOKE_CHANCE = 0.05;
const ROCKET_SMOKE_PER_SECOND = 60;
const SPARK_COUNT = 150;
const SPARK_DRAG = 0.05;
const SMOKE_DRAG = 0.05;

const flowForce = new THREE.Vector3();
const acc = new THREE.Vector3();
const color = new THREE.Color();

class Particle {
  constructor(pos, vel, life, drag) {
    this.pos = pos.clone();
    this.vel = vel;
    this.life = life;
    this.maxLife = life;
    this.drag = drag;
  }

  update(dt, force) {
    this.vel.addScaledVector(force, dt);
    this.vel.multiplyScalar(Math.pow(this.drag, dt));
    this.pos.addScaledVector(this.vel, dt);
    this.life -= dt;
  }

  done() {
    return this.life <= 0;
  }

  get alpha() {
    return Math.max(this.life / this.maxLife, 0);
  }
}

function randomOnSphere() {
  return new THREE.Vector3().randomDirection();
}

export class Firework {
  constructor() {
    this.hu = Math.random();
    const start = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(160),
      0,
      -THREE.MathUtils.randFloat(70, 150)
    );
    const vel = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(6),
      THREE.MathUtils.randFloat(35, 48),
      THREE.MathUtils.randFloatSpread(6)
    );
    this.rocket = new Particle(start, vel, Infinity, 1);
    this.exploded = false;
    this.particles = [];
    this.smoke = [];
  }

  done() {
    return this.exploded && this.particles.length === 0 && this.smoke.length === 0;
  }

  addSmoke(pos) {
    const vel = randomOnSphere().multiplyScalar(THREE.MathUtils.randFloat(0.5, 2));
    this.smoke.push(new Particle(pos, vel, THREE.MathUtils.randFloat(2.5, 4), SMOKE_DRAG));
  }

  update(dt, flow) {
    if (!this.exploded) {
      this.rocket.update(dt, GRAVITY);
      if (Math.random() < ROCKET_SMOKE_PER_SECOND * dt) this.addSmoke(this.rocket.pos);

      if (this.rocket.vel.y <= 0) {
        this.exploded = true;
        this.explode();
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      curl3D(flow, p.pos.x, p.pos.y, p.pos.z, flowForce);
      acc.copy(GRAVITY).addScaledVector(flowForce, FLOW_STRENGTH);
      p.update(dt, acc);

      if (Math.random() < SMOKE_CHANCE * 60 * dt) this.addSmoke(p.pos);
      if (p.done()) this.particles.splice(i, 1);
    }

    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      curl3D(flow, s.pos.x, s.pos.y, s.pos.z, flowForce);
      acc.copy(flowForce).multiplyScalar(SMOKE_FLOW_STRENGTH);
      acc.y += SMOKE_RISE;
      s.update(dt, acc);
      if (s.done()) this.smoke.splice(i, 1);
    }
  }

  explode() {
    for (let i = 0; i < SPARK_COUNT; i++) {
      const vel = randomOnSphere().multiplyScalar(THREE.MathUtils.randFloat(20, 60));
      this.particles.push(new Particle(this.rocket.pos, vel, THREE.MathUtils.randFloat(1.5, 2.5), SPARK_DRAG));
    }
  }

  show(sparkLayer, smokeLayer) {
    for (const s of this.smoke) {
      smokeLayer.push(s.pos, 0.6, 0.6, 0.6, s.alpha * 0.08);
    }

    if (!this.exploded) {
      sparkLayer.push(this.rocket.pos, 1, 0.9, 0.7, 1);
    }

    color.setHSL(this.hu, 1, 0.6);
    for (const p of this.particles) {
      sparkLayer.push(p.pos, color.r, color.g, color.b, p.alpha);
    }
  }
}
