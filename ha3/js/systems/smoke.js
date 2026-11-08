import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { scene } from '../renderer.js';
import { state } from '../state.js';
import { textures } from '../textures.js';
import { rand, lerp } from '../utils.js';

// Rauch: ein kleiner Sprite-Pool mit fester Obergrenze.

export function initSmoke() {
  for (let i = 0; i < CONFIG.smoke.max; i++) {
    const material = new THREE.SpriteMaterial({
      map: textures.smoke,
      color: 0x8d8073,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    scene.add(sprite);
    state.smoke.push({
      sprite,
      material,
      life: 0,
      maxLife: 1,
      velocity: new THREE.Vector3(),
    });
  }
}

export function updateSmoke(dt) {
  state.smokeTimer -= dt;
  if (state.smokeTimer <= 0) {
    state.smokeTimer = CONFIG.smoke.interval * rand(0.7, 1.35);
    const active = state.wicks.filter((wick) => wick.active);
    if (active.length && Math.random() > 0.28) {
      const wick = active[Math.floor(Math.random() * active.length)];
      const puff = state.smoke.find((candidate) => candidate.life <= 0);
      if (puff) {
        puff.life = rand(1.8, 3.2);
        puff.maxLife = puff.life;
        puff.sprite.visible = true;
        puff.sprite.position.set(
          wick.tipWorld.x + rand(-0.02, 0.02),
          wick.tipWorld.y + rand(0.22, 0.34),
          wick.tipWorld.z + rand(-0.02, 0.02),
        );
        puff.sprite.scale.setScalar(0.08);
        puff.velocity.set(
          rand(-0.025, 0.025) + state.wind.x * 0.08,
          rand(0.12, 0.22),
          rand(-0.02, 0.02) + state.wind.z * 0.08,
        );
        puff.material.opacity = 0;
      }
    }
  }

  for (const puff of state.smoke) {
    if (puff.life <= 0) continue;
    puff.life -= dt;
    if (puff.life <= 0) {
      puff.sprite.visible = false;
      puff.material.opacity = 0;
      continue;
    }
    const t = puff.life / puff.maxLife;
    puff.sprite.position.addScaledVector(puff.velocity, dt);
    puff.velocity.y += 0.035 * dt;
    puff.sprite.position.x += state.wind.x * 0.09 * dt;
    puff.sprite.position.z += state.wind.z * 0.09 * dt;
    const size = lerp(0.58, 0.08, t);
    puff.sprite.scale.setScalar(size);
    puff.material.opacity = Math.sin(Math.PI * t) * 0.13;
  }
}
