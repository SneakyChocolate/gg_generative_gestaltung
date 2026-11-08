import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { materials } from '../materials.js';
import { scene } from '../renderer.js';
import { state } from '../state.js';
import { clamp, rand } from '../utils.js';

// Abgebrochene Wachsstuecke mit parabolischer Flugbahn und Aufschmelzen.

export class ShardSystem {
  constructor() {
    this.shards = [];
    this.box = new THREE.Box3();
  }

  spawn(part) {
    if (this.shards.length >= CONFIG.shards.max) return null;
    // split() schneidet das Mesh an einer Ebene und liefert einen
    // geschlossenen, gecappten Brocken samt Hauptrest zurueck.
    const chunk = part.split();
    if (!chunk) return null;

    const mesh = new THREE.Mesh(chunk.geometry, materials.shard);
    // Etwas vom Buchstaben weg erzeugen, damit der Brocken nicht im Rest steckt.
    mesh.position.copy(chunk.center).addScaledVector(chunk.normal, CONFIG.shards.spawnGap);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const outward = chunk.center.clone();
    outward.y = 0;
    if (outward.lengthSq() < 0.0001) outward.set(rand(-1, 1), 0, rand(-0.4, 0.4));
    outward.normalize();

    this.shards.push({
      mesh,
      velocity: new THREE.Vector3(
        outward.x * rand(0.1, 0.3) + rand(-0.15, 0.15),
        rand(0.1, 0.35),
        outward.z * rand(0.1, 0.3) + rand(-0.18, 0.18),
      ),
      angularVelocity: new THREE.Vector3(
        rand(-1.2, 1.2),
        rand(-1.5, 1.5),
        rand(-1.2, 1.2),
      ),
      volume: chunk.volume,
      restTime: 0,
      meltTime: 0,
      settled: false,
    });

    part.stress = 0;
    part.cooldown = CONFIG.shards.cooldown;
    return mesh;
  }

  update(dt) {
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const shard = this.shards[i];
      const mesh = shard.mesh;

      if (!shard.settled) {
        shard.velocity.y -= CONFIG.shards.gravity * dt;
        shard.velocity.multiplyScalar(Math.max(0, 1 - CONFIG.shards.drag * dt));
        mesh.position.addScaledVector(shard.velocity, dt);
        mesh.rotation.x += shard.angularVelocity.x * dt;
        mesh.rotation.y += shard.angularVelocity.y * dt;
        mesh.rotation.z += shard.angularVelocity.z * dt;

        mesh.updateMatrixWorld(true);
        this.box.setFromObject(mesh);

        // TABLE: Auch Splitter kennen nur die eine Kollisionsebene.
        if (this.box.min.y < CONFIG.tableY) {
          mesh.position.y += CONFIG.tableY - this.box.min.y;
          if (shard.velocity.y < 0) shard.velocity.y *= -0.18;
          shard.velocity.x *= 0.64;
          shard.velocity.z *= 0.64;
          shard.angularVelocity.multiplyScalar(0.55);
          shard.restTime += dt;
          if (shard.restTime > 0.55) {
            shard.settled = true;
            shard.velocity.set(0, 0, 0);
            shard.angularVelocity.set(0, 0, 0);
          }
        } else {
          shard.restTime = 0;
        }
      } else {
        shard.meltTime += dt;
        if (shard.meltTime > CONFIG.shards.restMeltDelay) {
          const fade = clamp(
            (shard.meltTime - CONFIG.shards.restMeltDelay) / 0.9,
            0,
            1,
          );
          mesh.scale.setScalar(Math.max(0.001, 1 - fade));
          if (fade >= 1) {
            const volume = shard.volume * 1.2;
            state.puddles.add(mesh.position.x, mesh.position.z, volume, 0.5);
            scene.remove(mesh);
            mesh.geometry.dispose();
            this.shards.splice(i, 1);
          }
        }
      }
    }
  }

  clear() {
    for (const shard of this.shards) {
      scene.remove(shard.mesh);
      shard.mesh.geometry.dispose();
    }
    this.shards.length = 0;
  }
}
