import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { materials } from '../materials.js';
import { scene } from '../renderer.js';
import { state } from '../state.js';
import { clamp, rand } from '../utils.js';

// Fallende Wachstropfen: Schwerkraft, Luftwiderstand, Wind, Verschmelzen.

export class DropletSystem {
  constructor() {
    this.drops = [];
    this.spawnTimer = 0.8;
    this.dummy = new THREE.Object3D();
    this.geometry = new THREE.SphereGeometry(1, 10, 7);
    this.instanced = new THREE.InstancedMesh(
      this.geometry,
      materials.drop,
      CONFIG.melt.maxDrops,
    );
    this.instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instanced.frustumCulled = false;
    this.instanced.castShadow = false;
    this.instanced.receiveShadow = false;
    this.instanced.count = 0;
    scene.add(this.instanced);
  }

  update(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = CONFIG.melt.dropInterval + Math.random() * CONFIG.melt.dropJitter;
      this.trySpawn();
    }

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];

      // Schwerkraft + Luftwiderstand + Wind.
      drop.velocity.y -= CONFIG.melt.gravity * dt;
      drop.velocity.multiplyScalar(Math.max(0, 1 - CONFIG.melt.drag * dt));
      drop.velocity.x += state.wind.x * CONFIG.melt.dropPush * dt;
      drop.velocity.z += state.wind.z * CONFIG.melt.dropPush * dt;
      drop.position.addScaledVector(drop.velocity, dt);

      // TABLE: Aufprall auf der Tischebene.
      if (drop.position.y - drop.radius <= CONFIG.tableY) {
        this.land(drop);
        this.drops.splice(i, 1);
      }
    }

    this.merge();
    this.updateInstances();
  }

  trySpawn() {
    const active = state.wicks.filter((wick) => wick.active && wick.lit > 0.55);
    if (active.length === 0 || this.drops.length >= CONFIG.melt.maxDrops) return;

    const wick = active[Math.floor(Math.random() * active.length)];
    const part = wick.part;
    if (!part.rimCandidates.length) return;

    // rimCandidates enthaelt logische (verschweisste) Vertex-Indizes.
    // Deren aktuelle Position steht in uniquePos, nicht im Renderbuffer.
    const vertex = part.rimCandidates[Math.floor(Math.random() * part.rimCandidates.length)];
    const ix = vertex * 3;
    const positions = part.uniquePos;
    const x = part.mesh.position.x + positions[ix];
    const y = CONFIG.tableY + positions[ix + 1];
    const z = part.mesh.position.z + positions[ix + 2];

    const centerX = part.mesh.position.x + (part.bbox.min.x + part.bbox.max.x) / 2;
    const centerZ = part.mesh.position.z + (part.bbox.min.z + part.bbox.max.z) / 2;
    let outwardX = x - centerX;
    let outwardZ = z - centerZ;
    const length = Math.hypot(outwardX, outwardZ) || 1;
    outwardX /= length;
    outwardZ /= length;

    const radius = rand(CONFIG.melt.radiusMin, CONFIG.melt.radiusMax);
    const temp = clamp(part.uniqueTemps[vertex], 0.35, 1);
    this.drops.push({
      position: new THREE.Vector3(
        x + outwardX * 0.025,
        y - 0.015,
        z + outwardZ * 0.025,
      ),
      velocity: new THREE.Vector3(
        outwardX * rand(0.03, 0.1),
        rand(-0.06, -0.01),
        outwardZ * rand(0.03, 0.1),
      ),
      radius,
      temp,
    });
  }

  // Zwei Tropfen in der Luft verschmelzen zu einem groesseren.
  merge() {
    for (let i = 0; i < this.drops.length; i++) {
      for (let j = i + 1; j < this.drops.length; j++) {
        const a = this.drops[i];
        const b = this.drops[j];
        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const dz = a.position.z - b.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance >= (a.radius + b.radius) * 0.86) continue;

        const volumeA = a.radius ** 3;
        const volumeB = b.radius ** 3;
        const total = volumeA + volumeB;
        a.position
          .multiplyScalar(volumeA / total)
          .addScaledVector(b.position, volumeB / total);
        a.velocity
          .multiplyScalar(volumeA / total)
          .addScaledVector(b.velocity, volumeB / total);
        a.radius = Math.cbrt(total);
        a.temp = (a.temp * volumeA + b.temp * volumeB) / total;
        this.drops.splice(j, 1);
        j--;
      }
    }
  }

  land(drop) {
    const volume = (4 / 3) * Math.PI * drop.radius ** 3 * CONFIG.puddles.volumeScale;
    state.puddles.add(drop.position.x, drop.position.z, volume, drop.temp);
  }

  updateInstances() {
    this.instanced.count = this.drops.length;
    for (let i = 0; i < this.drops.length; i++) {
      const drop = this.drops[i];
      this.dummy.position.copy(drop.position);
      const stretch = 1 + Math.min(1.7, Math.abs(drop.velocity.y) * 0.13);
      this.dummy.scale.set(drop.radius, drop.radius * stretch, drop.radius);
      this.dummy.updateMatrix();
      this.instanced.setMatrixAt(i, this.dummy.matrix);
    }
    this.instanced.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.drops.length = 0;
    this.instanced.count = 0;
    this.instanced.instanceMatrix.needsUpdate = true;
    this.spawnTimer = 0.8;
  }
}
