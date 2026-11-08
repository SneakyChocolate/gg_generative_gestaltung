import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { materials } from '../materials.js';
import { scene } from '../renderer.js';
import { state } from '../state.js';
import { smoothstep } from '../utils.js';

// Docht, Flamme, Abbrand und das mitwandernde Punktlicht.

const wickGeometry = new THREE.CylinderGeometry(
  CONFIG.wick.radius,
  CONFIG.wick.radius * 1.45,
  1,
  6,
  1,
  false,
);

export class Wick {
  constructor(part, anchor, index) {
    this.part = part;
    this.index = index;
    this.localBase = anchor.clone();
    this.height = CONFIG.wick.height;
    this.burn = 0;
    this.lit = 0;
    this.active = false;
    this.ignitionDelay = 0.35 + index * CONFIG.wick.igniteGap;
    this.seed = Math.random() * 1000;

    // localHeat liegt im Koordinatensystem des Buchstaben-Meshes.
    this.localHeat = new THREE.Vector3(anchor.x, anchor.y, anchor.z);
    this.surfaceY = anchor.y;
    this.worldBase = new THREE.Vector3(
      part.mesh.position.x + anchor.x,
      CONFIG.tableY + anchor.y,
      part.mesh.position.z + anchor.z,
    );
    this.tipWorld = new THREE.Vector3().copy(this.worldBase);

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

    this.reset();
  }

  update(dt, time, elapsed) {
    this.lit = smoothstep(
      this.ignitionDelay,
      this.ignitionDelay + CONFIG.wick.igniteDuration,
      elapsed,
    );
    this.active = this.lit > 0.04;

    if (this.active) {
      this.burn = Math.min(
        this.height * 0.92,
        this.burn + CONFIG.wick.burnSpeed * dt,
      );
    }

    const remaining = Math.max(0.012, this.height - this.burn);
    // Flamme folgt der abgesackten Wachsoberflaeche.
    this.followSurface();
    this.localHeat.set(
      this.localBase.x,
      this.surfaceY + remaining,
      this.localBase.z,
    );
    this.tipWorld.set(
      this.worldBase.x,
      this.worldBase.y + remaining,
      this.worldBase.z,
    );

    // Der Docht wird kuerzer; die Flamme wandert mit nach unten.
    const wickScale = remaining / this.height;
    this.mesh.scale.set(1, wickScale, 1);
    this.mesh.position.set(
      this.worldBase.x,
      this.worldBase.y + remaining * 0.5,
      this.worldBase.z,
    );

    // Flackern aus drei Sinuswellen: langsame Unruhe + schnelle Zuckung.
    const flicker = 0.88 +
      Math.sin(time * 12.7 + this.seed) * 0.075 +
      Math.sin(time * 27.3 + this.seed * 1.7) * 0.045 +
      Math.sin(time * 6.1 + this.seed * 0.37) * 0.035;

    const sway = state.wind.x * CONFIG.wind.flameSway +
      Math.sin(time * 2.3 + this.seed) * 0.006;
    const swayZ = state.wind.z * CONFIG.wind.flameSway +
      Math.cos(time * 1.9 + this.seed) * 0.004;

    this.flame.position.set(
      this.tipWorld.x + sway,
      this.tipWorld.y,
      this.tipWorld.z + swayZ,
    );
    const flameScale = this.lit * flicker;
    this.flame.scale.setScalar(flameScale);
    this.flame.visible = this.lit > 0.01;

    if (this.light) {
      this.light.position.set(
        this.tipWorld.x + sway * 1.6,
        this.tipWorld.y + 0.11,
        this.tipWorld.z + swayZ * 1.6,
      );
      this.light.intensity = this.lit * (5.5 + flicker * 3.5);
    }
  }

  // Nach einem Bruch wandert der Docht auf die neue, tiefere Oberflaeche.
  // localBase/worldBase werden nachgezogen; die restliche Flamme folgt
  // beim naechsten update() automatisch.
  setAnchor(anchor) {
    this.localBase.copy(anchor);
    this.surfaceY = anchor.y;
    this.worldBase.set(
      this.part.mesh.position.x + anchor.x,
      CONFIG.tableY + anchor.y,
      this.part.mesh.position.z + anchor.z,
    );
    this.localHeat.set(this.localBase.x, this.surfaceY + this.height, this.localBase.z);
    this.tipWorld.set(this.worldBase.x, this.worldBase.y + this.height, this.worldBase.z);
  }

  // Liest die aktuelle Hoehe des Wachses unter dem Docht. Waehrend des
  // Schmelzens sinkt die Flamme mit der Oberflaeche ab.
  followSurface() {
    const part = this.part;
    if (!part || !part.uniquePos) return;
    const y = part.surfaceHeightNear(this.localBase.x, this.localBase.z);
    if (Number.isFinite(y)) this.surfaceY = Math.max(0.015, y);
    this.worldBase.set(
      part.mesh.position.x + this.localBase.x,
      CONFIG.tableY + this.surfaceY,
      part.mesh.position.z + this.localBase.z,
    );
  }

  reset() {
    this.burn = 0;
    this.lit = 0;
    this.active = false;
    const remaining = this.height;
    this.surfaceY = this.localBase.y;
    this.localHeat.set(this.localBase.x, this.surfaceY + remaining, this.localBase.z);
    this.tipWorld.set(this.worldBase.x, this.worldBase.y + remaining, this.worldBase.z);
    this.mesh.scale.set(1, 1, 1);
    this.mesh.position.set(
      this.worldBase.x,
      this.worldBase.y + remaining * 0.5,
      this.worldBase.z,
    );
    this.flame.visible = false;
    this.flame.scale.setScalar(0);
    if (this.light) this.light.intensity = 0;
  }
}
