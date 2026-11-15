import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { noisePotential3D } from './curlnoise.js';
import { ParticlePool, launchRocket, updateRockets, updateSparks, updateSmoke } from './firework.js';

const EYE_HEIGHT = 1.7;
const LOOK_UP_DEG = 30;
const FOV = 75;
const LAUNCHES_PER_SECOND = 1.5;
const FLOW_SCALE = 0.02;
const FLOW_SPEED = 0.25;
const TRAIL_DAMP = 0.9;
const MAX_ROCKETS = 64;
const MAX_SPARKS = 20000;
const MAX_SMOKE = 20000;
const SPARK_DRAG = 0.05;
const SMOKE_DRAG = 0.05;

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
function pointsMaterial(size, blending) {
  return new THREE.PointsMaterial({ size, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending });
}

const rockets = new ParticlePool(MAX_ROCKETS, 1, pointsMaterial(2, THREE.AdditiveBlending));
const sparks = new ParticlePool(MAX_SPARKS, SPARK_DRAG, pointsMaterial(1.2, THREE.AdditiveBlending));
const smoke = new ParticlePool(MAX_SMOKE, SMOKE_DRAG, pointsMaterial(4, THREE.NormalBlending));
scene.add(smoke.points, sparks.points, rockets.points);

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

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const flow = noisePotential3D(FLOW_SCALE, clock.elapsedTime * FLOW_SPEED);

  if (Math.random() < LAUNCHES_PER_SECOND * dt) launchRocket(rockets);

  updateRockets(rockets, sparks, smoke, dt);
  updateSparks(sparks, smoke, flow, dt);
  updateSmoke(smoke, flow, dt);
  rockets.upload();
  sparks.upload();
  smoke.upload();

  composer.render();
});
