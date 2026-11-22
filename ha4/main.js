import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { noisePotential3D } from './curlnoise.js';
import { createWaterReflection } from './water.js';
import { updateListener } from './sound.js';
import { ParticlePool, ORBIT_STRIDE, ROCKET_STRIDE, KIND, LAUNCHABLE, enabledKinds, fountainTuning, launchRocket, launchSalvo, updateRockets, updateSparks, updateDrops, updateOrbits, updateSmoke } from './firework.js';

const EYE_HEIGHT = 1.7;
const LOOK_UP_DEG =6;
const LOOK_RIGHT_DEG = 12;
const FOV = 100;
const LAUNCHES_PER_SECOND = 1.5;
const SALVO_SHARE = 0.25;
const FIREWORK_SPEED = 1.5;
const FLOW_SCALE = 0.02;
const FLOW_SPEED = 0.25;
const TRAIL_DAMP = 0.9;
const MAX_ROCKETS = 256;
const MAX_SPARKS = 20000;
const MAX_SMOKE = 20000;
const MAX_SHAPES = 4000;
const SPARK_DRAG = 0.05;
const SMOKE_DRAG = 0.05;
const SKY_LIGHT = 0x3a4a70;
const GROUND_LIGHT = 0x0a0a12;
const SKY_INTENSITY = 2;
const FLASH_LIGHTS = 6;
const FLASH_INTENSITY = 10000;
const FLASH_DECAY = 0.6;
const FLASH_RANGE = 150;
const FOUNTAIN_LIGHT_RANGE = 60;
const FOUNTAIN_LIGHT_INTENSITY = 150;
const MAX_DROPS = 4000;
const DROP_REFLECTION_GAIN = 6;

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
scene.fog = new THREE.Fog(0x000004, 80, 600);

const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(75, EYE_HEIGHT, 60);
camera.rotation.order = 'YXZ';
camera.rotation.x = THREE.MathUtils.degToRad(LOOK_UP_DEG);
camera.rotation.y = THREE.MathUtils.degToRad(LOOK_RIGHT_DEG);

const debugPanel = document.createElement('pre');
debugPanel.style.cssText = 'position:fixed;top:8px;left:8px;margin:0;padding:8px 12px;color:#fff;background:rgba(0,0,0,0.6);font:14px monospace;display:none;pointer-events:none';
document.body.appendChild(debugPanel);

const kindPanel = document.createElement('div');
kindPanel.style.cssText = 'position:fixed;top:170px;left:8px;padding:8px 12px;color:#fff;background:rgba(0,0,0,0.6);font:14px monospace;display:none';
for (const kind of LAUNCHABLE) {
  const label = document.createElement('label');
  label.style.display = 'block';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = enabledKinds.has(kind);
  checkbox.addEventListener('change', () => enabledKinds[checkbox.checked ? 'add' : 'delete'](kind));
  label.append(checkbox, ` ${Object.keys(KIND).find(name => KIND[name] === kind).toLowerCase()}`);
  kindPanel.append(label);
}
for (const [key, max, step] of [['dropAlpha', 0.5, 0.01], ['dropsPerSecond', 200, 1]]) {
  const label = document.createElement('label');
  label.style.display = 'block';
  const value = document.createElement('span');
  value.textContent = fountainTuning[key];
  const slider = Object.assign(document.createElement('input'), { type: 'range', min: 0, max, step, value: fountainTuning[key] });
  slider.addEventListener('input', () => {
    fountainTuning[key] = Number(slider.value);
    value.textContent = slider.value;
  });
  label.append(`${key} `, value, document.createElement('br'), slider);
  kindPanel.append(label);
}
document.body.appendChild(kindPanel);

function updateDebugPanel() {
  const [x, y, z] = ['x', 'y', 'z'].map(axis => THREE.MathUtils.radToDeg(camera.rotation[axis]).toFixed(1).padStart(7));
  debugPanel.textContent = `camera rotation\nX: ${x}\nY: ${y}\nZ: ${z}\nfps: ${fps.toFixed(0)}\nparticles: ${[rockets, drops, ...shapePools, orbits, smoke].reduce((sum, pool) => sum + pool.count, 0)}`;
}

window.addEventListener('keydown', event => {
  if (event.key.toLowerCase() !== 'd') return;
  const display = debugPanel.style.display === 'none' ? 'block' : 'none';
  debugPanel.style.display = kindPanel.style.display = display;
});

const DRAG_SENSITIVITY = 0.003;
const MAX_PITCH = Math.PI / 2;
renderer.domElement.style.cursor = 'grab';
renderer.domElement.addEventListener('pointerdown', event => renderer.domElement.setPointerCapture(event.pointerId));
renderer.domElement.addEventListener('pointermove', event => {
  if (!renderer.domElement.hasPointerCapture(event.pointerId)) return;
  camera.rotation.y += event.movementX * DRAG_SENSITIVITY;
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x + event.movementY * DRAG_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
});

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(4000, 4000),
  new THREE.MeshBasicMaterial({ color: 0x050608 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -11;
scene.add(ground);

scene.add(new THREE.HemisphereLight(SKY_LIGHT, GROUND_LIGHT, SKY_INTENSITY));

const dot = softDotTexture();
function pointsMaterial(size, blending, map = dot) {
  return new THREE.PointsMaterial({ size, map, vertexColors: true, transparent: true, depthWrite: false, blending });
}

const rockets = new ParticlePool(MAX_ROCKETS, 1, pointsMaterial(2, THREE.AdditiveBlending), ROCKET_STRIDE);
const sparks = new ParticlePool(MAX_SPARKS, SPARK_DRAG, pointsMaterial(1.2, THREE.AdditiveBlending));
const drops = new ParticlePool(MAX_DROPS, 1, pointsMaterial(0.4, THREE.AdditiveBlending));
drops.reflectionGain = DROP_REFLECTION_GAIN;
const hearts = new ParticlePool(MAX_SHAPES, SPARK_DRAG, pointsMaterial(5, THREE.AdditiveBlending, heartTexture()));
const stars = new ParticlePool(MAX_SHAPES, SPARK_DRAG, pointsMaterial(3.5, THREE.AdditiveBlending, starTexture()));
const orbits = new ParticlePool(MAX_SHAPES, 1, pointsMaterial(1.6, THREE.AdditiveBlending), ORBIT_STRIDE);
const smoke = new ParticlePool(MAX_SMOKE, SMOKE_DRAG, pointsMaterial(4, THREE.NormalBlending));
const flashLights = Array.from({ length: FLASH_LIGHTS }, () => {
  const light = new THREE.PointLight(0xffffff, 0, FLASH_RANGE);
  scene.add(light);
  return light;
});
const flashAges = new Float32Array(FLASH_LIGHTS).fill(Infinity);
let nextFlash = 0;

function flash(x, y, z, color) {
  const n = nextFlash++ % FLASH_LIGHTS;
  flashLights[n].position.set(x, y, z);
  flashLights[n].color.copy(color);
  flashAges[n] = 0;
}

function updateFlashes(dt) {
  for (let n = 0; n < FLASH_LIGHTS; n++) {
    flashAges[n] += dt;
    flashLights[n].intensity = FLASH_INTENSITY * Math.exp(-flashAges[n] / FLASH_DECAY);
  }
}

const fountainLight = new THREE.PointLight(0xffffff, 0, FOUNTAIN_LIGHT_RANGE);
scene.add(fountainLight);

function fountainGlow(x, y, z, color, strength) {
  fountainLight.position.set(x, y, z);
  fountainLight.color.copy(color);
  fountainLight.intensity = FOUNTAIN_LIGHT_INTENSITY * strength;
}

const pools = { sparks, hearts, stars, orbits, smoke, flash, fountainGlow, drops };
const shapePools = [sparks, hearts, stars];
scene.add(smoke.points, drops.points, sparks.points, hearts.points, stars.points, orbits.points, rockets.points);

const water = createWaterReflection(renderer, [rockets, sparks, drops, hearts, stars, orbits], scene.fog);
new GLTFLoader().load('./assets/city.glb', gltf => {
  water.setWater(gltf.scene.getObjectByName('water'));
  gltf.scene.traverse(object => {
    if (object.material?.name === '') object.material.metalness = 0;
    if (object.material?.name === 'concrete') object.material.roughness = 1;
  });
  scene.add(gltf.scene);
});

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
  water.resize();
});

const clock = new THREE.Clock();
const FPS_INTERVAL = 0.2;
let fps = 0;
let fpsFrames = 0;
let fpsTime = 0;

renderer.setAnimationLoop(() => {
  const frameTime = clock.getDelta();
  fpsFrames++;
  fpsTime += frameTime;
  if (fpsTime >= FPS_INTERVAL) {
    fps = fpsFrames / fpsTime;
    fpsFrames = 0;
    fpsTime = 0;
  }
  const dt = Math.min(frameTime, 1 / 30);
  const flow = noisePotential3D(FLOW_SCALE, clock.elapsedTime * FLOW_SPEED);

  if (Math.random() < LAUNCHES_PER_SECOND * dt) (Math.random() < SALVO_SHARE ? launchSalvo : launchRocket)(rockets);

  const simDt = dt * FIREWORK_SPEED;
  updateRockets(rockets, pools, simDt);
  for (const pool of shapePools) updateSparks(pool, smoke, flow, simDt);
  updateDrops(drops, simDt);
  updateOrbits(orbits, smoke, simDt);
  updateSmoke(smoke, flow, simDt);
  updateFlashes(simDt);
  for (const pool of [rockets, drops, ...shapePools, orbits, smoke]) pool.upload();

  if (debugPanel.style.display !== 'none') updateDebugPanel();
  updateListener(camera);
  water.render(camera, clock.elapsedTime);
  composer.render();
});
