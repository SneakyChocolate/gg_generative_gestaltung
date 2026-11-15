import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { noisePotential3D } from './curlnoise.js';
import { ParticlePool, ORBIT_STRIDE, ROCKET_STRIDE, launchRocket, launchSalvo, updateRockets, updateSparks, updateOrbits, updateSmoke } from './firework.js';

const EYE_HEIGHT = 1.7;
const LOOK_UP_DEG = 30;
const FOV = 75;
const LAUNCHES_PER_SECOND = 1.5;
const SALVO_SHARE = 0.25;
const FLOW_SCALE = 0.02;
const FLOW_SPEED = 0.25;
const TRAIL_DAMP = 0.9;
const MAX_ROCKETS = 256;
const MAX_SPARKS = 20000;
const MAX_SMOKE = 20000;
const MAX_SHAPES = 4000;
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

function shapeTexture(trace) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.translate(32, 29);
  ctx.shadowColor = 'white';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'white';
  ctx.beginPath();
  trace(ctx);
  ctx.closePath();
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

function heartTexture() {
  return shapeTexture(ctx => {
    for (let t = 0; t <= Math.PI * 2; t += 0.1) {
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      ctx.lineTo(x * 1.4, -y * 1.4);
    }
  });
}

function starTexture() {
  return shapeTexture(ctx => {
    for (let n = 0; n < 10; n++) {
      const angle = -Math.PI / 2 + (n * Math.PI) / 5;
      const radius = n % 2 ? 11 : 26;
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius + 3);
    }
  });
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

scene.add(new THREE.AmbientLight(0x404050, 1));
const moon = new THREE.DirectionalLight(0x9db4ff, 2);
moon.position.set(-200, 80, -40);
scene.add(moon);
new GLTFLoader().load('./assets/city.glb', gltf => scene.add(gltf.scene));

const dot = softDotTexture();
function pointsMaterial(size, blending, map = dot) {
  return new THREE.PointsMaterial({ size, map, vertexColors: true, transparent: true, depthWrite: false, blending });
}

const rockets = new ParticlePool(MAX_ROCKETS, 1, pointsMaterial(2, THREE.AdditiveBlending), ROCKET_STRIDE);
const sparks = new ParticlePool(MAX_SPARKS, SPARK_DRAG, pointsMaterial(1.2, THREE.AdditiveBlending));
const hearts = new ParticlePool(MAX_SHAPES, SPARK_DRAG, pointsMaterial(5, THREE.AdditiveBlending, heartTexture()));
const stars = new ParticlePool(MAX_SHAPES, SPARK_DRAG, pointsMaterial(3.5, THREE.AdditiveBlending, starTexture()));
const orbits = new ParticlePool(MAX_SHAPES, 1, pointsMaterial(1.6, THREE.AdditiveBlending), ORBIT_STRIDE);
const smoke = new ParticlePool(MAX_SMOKE, SMOKE_DRAG, pointsMaterial(4, THREE.NormalBlending));
const pools = { sparks, hearts, stars, orbits, smoke };
const shapePools = [sparks, hearts, stars];
scene.add(smoke.points, sparks.points, hearts.points, stars.points, orbits.points, rockets.points);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new AfterimagePass(TRAIL_DAMP));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.1, 0.1));
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

  if (Math.random() < LAUNCHES_PER_SECOND * dt) (Math.random() < SALVO_SHARE ? launchSalvo : launchRocket)(rockets);

  updateRockets(rockets, pools, dt);
  for (const pool of shapePools) updateSparks(pool, smoke, flow, dt);
  updateOrbits(orbits, smoke, dt);
  updateSmoke(smoke, flow, dt);
  for (const pool of [rockets, ...shapePools, orbits, smoke]) pool.upload();

  composer.render();
});
