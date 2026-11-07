import * as THREE from "three";
import { FLAME_LIGHT } from "./config.js";

const glow = createGlowTexture();

export function createFlame(scene) {
  const group = new THREE.Group();
  const outer = createSprite(0xff8a2a, 0.1, 0.28, 0.14);
  const inner = createSprite(0xfff1c4, 0.05, 0.14, 0.09);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 6), new THREE.MeshBasicMaterial({ color: 0x1a1410 }));
  wick.position.y = 0.03;
  const light = new THREE.PointLight(0xff9a40, FLAME_LIGHT, 4, 2);
  light.position.y = 0.15;
  group.add(wick, outer, inner, light);
  scene.add(group);
  const phase = Math.random() * 100;
  return {
    setPosition(x, y, z) {
      group.position.set(x, y, z);
    },
    update(time) {
      const flicker = 1 + 0.08 * Math.sin(time * 13 + phase) + 0.05 * Math.sin(time * 29 + phase * 1.7);
      outer.scale.y = 0.28 * flicker;
      inner.scale.y = 0.14 * flicker;
      light.intensity = FLAME_LIGHT * flicker;
    },
    extinguish() {
      outer.visible = false;
      inner.visible = false;
      light.intensity = 0;
    },
  };
}

function createSprite(color, width, height, y) {
  const material = new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.position.y = y;
  return sprite;
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.6)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
