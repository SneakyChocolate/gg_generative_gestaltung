import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { materials } from '../materials.js';
import { scene } from '../renderer.js';
import { state } from '../state.js';
import { clamp, smoothstep } from '../utils.js';

// Docht, Flamme, Abbrand und das mitwandernde Punktlicht.

const wickGeometry = new THREE.CylinderGeometry(
  CONFIG.wick.radius,
  CONFIG.wick.radius * 1.45,
  1,
  6,
  1,
  false,
);

const UP = new THREE.Vector3(0, 1, 0);

export function flameHeatAt(x, y, z, radius) {
  let heat = 0;
  for (const wick of state.wicks) {
    if (!wick.active) continue;
    const tip = wick.tipWorld;
    const distance = Math.hypot(tip.x - x, tip.y - y, tip.z - z);
    heat = Math.max(heat, (1 - distance / radius) * wick.lit);
  }
  return Math.max(0, heat);
}

export class Wick {
  constructor(part, anchor, index) {
    this.part = part;
    this.index = index;
    this.localBase = new THREE.Vector3();
    this.localHeat = new THREE.Vector3();
    this.worldBase = new THREE.Vector3();
    this.tipWorld = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 1, 0);
    this.height = CONFIG.wick.height;
    this.length = 1;
    this.lit = 0;
    this.active = false;
    this.ignitionDelay = 0.35 + index * CONFIG.wick.igniteGap;
    this.seed = Math.random() * 1000;
    this.tiltAngle = this.seed;
    this.mesh = new THREE.Mesh(wickGeometry, materials.wick);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    this.flame = new THREE.Group();
    this.flame.visible = false;
    scene.add(this.flame);

    const outer = new THREE.Sprite(materials.flameOuter);
    outer.scale.set(0.5, 0.62, 1);
    outer.position.y = 0.13;
    this.flame.add(outer);

    const blue = new THREE.Sprite(materials.flameBlue);
    blue.scale.set(0.105, 0.09, 1);
    blue.position.y = 0.02;
    this.flame.add(blue);

    const main = new THREE.Sprite(materials.flameMain);
    main.scale.set(0.17, 0.42, 1);
    main.position.y = 0.15;
    this.flame.add(main);

    const core = new THREE.Sprite(materials.flameCore);
    core.scale.set(0.075, 0.21, 1);
    core.position.y = 0.115;
    this.flame.add(core);

    this.light = null;
    if (index % CONFIG.wick.lightEvery === 0) {
      this.light = new THREE.PointLight(0xff9b4e, 0, 4.2, 2.0);
      this.light.castShadow = false;
      scene.add(this.light);
    }

    this.setAnchor(anchor);
    this.reset();
  }

  update(dt, time, elapsed) {
    this.lit = smoothstep(
      this.ignitionDelay,
      this.ignitionDelay + CONFIG.wick.igniteDuration,
      elapsed,
    );
    this.active = this.lit > 0.04;

    if (this.out) {
      this.active = false;
      return;
    }

    const wax = this.part.surfaceHeightNear(
      this.localBase.x,
      this.localBase.z,
      CONFIG.wick.supportRadius,
    );
    if (!this.fallen && !(wax >= this.localBase.y + CONFIG.wick.minSupport)) {
      this.fallen = true;
      this.tiltVelocity = CONFIG.wick.fallKick;
    }

    if (this.active) {
      // Je weiter die Flamme vom Wachs und vom Boden entfernt ist, desto
      // langsamer schmilzt das Wachs; der Docht darf es nicht ueberholen.
      const gap = this.localHeat.y - (this.fallen ? this.localBase.y : wax);
      const supply = CONFIG.wick.supplyFloor +
        (1 - CONFIG.wick.supplyFloor) * smoothstep(0, CONFIG.wick.supplyGap, gap);
      const height = clamp((this.localHeat.y - this.localBase.y) / this.length, 0, 1);
      const heightFactor = CONFIG.wick.lowFlameRate + (1 - CONFIG.wick.lowFlameRate) * height;
      this.burn += CONFIG.wick.burnSpeed * supply * heightFactor * dt;
    }
    this.burn = Math.min(this.burn, this.length - CONFIG.wick.minLength);

    if (this.fallen && this.tilt < Math.PI / 2) {
      this.tiltVelocity += CONFIG.wick.fallGravity * Math.sin(this.tilt) * dt;
      this.tilt = Math.min(Math.PI / 2, this.tilt + this.tiltVelocity * dt);
    }
    this.placeWick();

    if (this.fallen && this.length - this.burn <= CONFIG.wick.minLength + 1e-3) {
      this.out = true;
      this.active = false;
      this.mesh.visible = false;
      this.flame.visible = false;
      if (this.light) this.light.intensity = 0;
      return;
    }

    // Flackern aus drei Sinuswellen: langsame Unruhe + schnelle Zuckung.
    const flicker = 0.88 +
      Math.sin(time * 12.7 + this.seed) * 0.075 +
      Math.sin(time * 27.3 + this.seed * 1.7) * 0.045 +
      Math.sin(time * 6.1 + this.seed * 0.37) * 0.035;

    const sway = state.wind.x * CONFIG.wind.flameSway +
      Math.sin(time * 2.3 + this.seed) * 0.006;
    const swayZ = state.wind.z * CONFIG.wind.flameSway +
      Math.cos(time * 1.9 + this.seed) * 0.004;

    const flameBase = this.tipWorld.clone().addScaledVector(this.dir, -CONFIG.wick.flameDrop);
    this.flame.position.set(
      flameBase.x + sway,
      flameBase.y,
      flameBase.z + swayZ,
    );
    const flameScale = this.lit * flicker;
    this.flame.scale.setScalar(flameScale);
    this.flame.visible = this.lit > 0.01;

    if (this.light) {
      this.light.position.set(
        flameBase.x + sway * 1.6,
        flameBase.y + 0.11,
        flameBase.z + swayZ * 1.6,
      );
      this.light.intensity = this.lit * (5.5 + flicker * 3.5);
    }
  }

  // Der Fusspunkt steht auf dem Tisch; nur die Spitze brennt nach unten.
  setAnchor(anchor) {
    this.localBase.set(anchor.x, 0, anchor.z);
    this.length = anchor.y + CONFIG.wick.extra;
    this.worldBase.set(
      this.part.mesh.position.x + anchor.x,
      CONFIG.tableY,
      this.part.mesh.position.z + anchor.z,
    );
    this.clearState();
    this.placeWick();
  }

  clearState() {
    this.burn = 0;
    this.tilt = 0;
    this.tiltVelocity = 0;
    this.fallen = false;
    this.out = false;
    this.mesh.visible = true;
  }

  placeWick() {
    const length = this.length - this.burn;
    const sinTilt = Math.sin(this.tilt);
    this.dir.set(
      sinTilt * Math.cos(this.tiltAngle),
      Math.cos(this.tilt),
      sinTilt * Math.sin(this.tiltAngle),
    );
    // Liegt der Docht, ruht er mit seinem Radius auf dem Tisch.
    const lift = CONFIG.wick.radius * 1.45 * sinTilt;
    this.tipWorld.copy(this.worldBase).addScaledVector(this.dir, length);
    this.tipWorld.y += lift;
    this.localHeat.set(
      this.tipWorld.x - this.part.mesh.position.x,
      this.tipWorld.y - CONFIG.tableY,
      this.tipWorld.z - this.part.mesh.position.z,
    );
    this.mesh.scale.set(1, length, 1);
    this.mesh.position.copy(this.worldBase).addScaledVector(this.dir, length * 0.5);
    this.mesh.position.y += lift;
    this.mesh.quaternion.setFromUnitVectors(UP, this.dir);
  }

  reset() {
    this.lit = 0;
    this.active = false;
    this.clearState();
    this.placeWick();
    this.flame.visible = false;
    this.flame.scale.setScalar(0);
    if (this.light) this.light.intensity = 0;
  }
}
