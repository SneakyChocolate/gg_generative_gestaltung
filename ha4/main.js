import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { noisePotential3D } from './curlnoise.js';
import { Firework } from './firework.js';

const EYE_HEIGHT = 1.7;
const LOOK_UP_DEG = 30;
const FOV = 75;
const LAUNCHES_PER_SECOND = 1.5;
const FLOW_SCALE = 0.02;
const FLOW_SPEED = 0.25;
const TRAIL_DAMP = 0.9;
const MAX_SPARKS = 20000;
const MAX_SMOKE = 20000;

class ParticleLayer {
  constructor(max, size, blending, texture) {
    this.max = max;
    this.count = 0;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 4);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.PointsMaterial({
      size,
      map: texture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
  }

  begin() {
    this.count = 0;
  }

  push(pos, r, g, b, a) {
    if (this.count >= this.max) return;
    this.positions.set([pos.x, pos.y, pos.z], this.count * 3);
    this.colors.set([r, g, b, a], this.count * 4);
    this.count++;
  }

  end() {
    this.geometry.setDrawRange(0, this.count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

function softDotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000004);

const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, EYE_HEIGHT, 0);
camera.rotation.x = THREE.MathUtils.degToRad(LOOK_UP_DEG);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(4000, 4000),
  new THREE.MeshBasicMaterial({ color: 0x050608 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const dot = softDotTexture();
const sparks = new ParticleLayer(MAX_SPARKS, 1.2, THREE.AdditiveBlending, dot);
const smoke = new ParticleLayer(MAX_SMOKE, 4, THREE.NormalBlending, dot);
scene.add(smoke.points, sparks.points);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new AfterimagePass(TRAIL_DAMP));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.6, 0.1));
composer.addPass(new OutputPass());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const fireworks = [];
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const flow = noisePotential3D(FLOW_SCALE, clock.elapsedTime * FLOW_SPEED);

  if (Math.random() < LAUNCHES_PER_SECOND * dt) fireworks.push(new Firework());

  sparks.begin();
  smoke.begin();
  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update(dt, flow);
    fireworks[i].show(sparks, smoke);
    if (fireworks[i].done()) fireworks.splice(i, 1);
  }
  sparks.end();
  smoke.end();

  composer.render();
});
