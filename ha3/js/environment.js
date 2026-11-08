import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from './config.js';
import { scene, camera, renderer } from './renderer.js';
import { materials } from './materials.js';
import { textures } from './textures.js';
import { state } from './state.js';
import { rand } from './utils.js';

// Kamera, Licht, Tisch und die dekorative Umgebung.

let backdrop;
let table;
let runner;

export function fitCamera(wordWidth) {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  const halfWidth = Math.max(3.4, wordWidth / 2 + 0.75);
  const halfHeight = 1.55;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const distanceForWidth = halfWidth / (Math.tan(vFov / 2) * aspect);
  const distanceForHeight = halfHeight / Math.tan(vFov / 2);
  const distance = Math.max(distanceForWidth, distanceForHeight) * CONFIG.camera.margin;
  camera.position.set(
    CONFIG.camera.offsetX,
    CONFIG.tableY + CONFIG.camera.height,
    distance,
  );
  camera.lookAt(0, CONFIG.tableY + CONFIG.camera.targetY, 0);
  camera.updateProjectionMatrix();
}
export function setupLights() {
  const ambient = new THREE.AmbientLight(0x40281a, 0.55);
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0x2b3950, 0x27140b, 0.34);
  scene.add(hemisphere);

  // Warmes Hauptlicht mit Schatten. Es kommt von links oben, damit die
  // Buchstaben plastisch stehen und die Flammen nicht dagegen ankaempfen.
  const key = new THREE.DirectionalLight(0xffdfb8, 1.28);
  key.position.set(-5.5, CONFIG.tableY + 8.5, 6.0);
  key.target.position.set(0, CONFIG.tableY + 0.45, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -5;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0006;
  key.shadow.radius = 3.5;
  scene.add(key);
  scene.add(key.target);

  // Kuehles Gegenlicht von hinten rechts: trennt das Wort vom Hintergrund.
  const rim = new THREE.DirectionalLight(0x5f7ea8, 0.36);
  rim.position.set(5, CONFIG.tableY + 4, -6);
  rim.target.position.set(0, CONFIG.tableY + 0.7, 0);
  scene.add(rim);
  scene.add(rim.target);

  // Warme Aufhellung von vorne rechts (kein Schatten, kostet wenig).
  const fill = new THREE.SpotLight(0xffa95c, 26, 22, 0.62, 0.9, 1.7);
  fill.position.set(4.5, CONFIG.tableY + 5.5, 5.0);
  fill.target.position.set(0, CONFIG.tableY + 0.55, 0);
  scene.add(fill);
  scene.add(fill.target);
}

// --- Umgebung, Tisch, Hintergrund -----------------------------------

export function setupEnvironment() {
  // Weiche Raumreflexion fuer Wachs und Kugeln. Kein eigener Shader.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTexture = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTexture;
  room.dispose();
  pmrem.dispose();

  // Hintergrundwand.
  backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 24),
    new THREE.MeshBasicMaterial({ map: textures.backdrop, fog: false }),
  );
  backdrop.position.set(0, CONFIG.tableY + 7.0, -10.5);
  scene.add(backdrop);

  // Tischplatte. TABLE: Die Kollisionsebene ist CONFIG.tableY.
  table = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 18),
    materials.table,
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = CONFIG.tableY;
  table.receiveShadow = true;
  scene.add(table);

  // Dunkelgruener Laeufer unter dem Wort.
  runner = new THREE.Mesh(
    new THREE.PlaneGeometry(13.5, 3.9),
    materials.runner,
  );
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, CONFIG.tableY + 0.0015, 0.1);
  runner.receiveShadow = true;
  scene.add(runner);

  // Zwei Goldkugeln als Weihnachtsstillleben, links und rechts.
  addBauble(-4.75, 0.95, 0.26, materials.gold);
  addBauble(4.65, 0.62, 0.18, materials.baubleRed);
  addFirSprig();

  // Staub in der Luft: kleine warme Punkte, die langsam treiben.
  createDust();
  createBokeh();
}

// Wird aufgerufen, wenn assets/scene.glb erfolgreich geladen wurde: Die
// prozedurale Tischplatte und die Hintergrundwand werden ausgeblendet, damit
// sie nicht mit der GLB-Umgebung kollidieren. Laeufer und Deko bleiben.
export function setProceduralBaseVisible(visible) {
  if (table) table.visible = visible;
  if (backdrop) backdrop.visible = visible;
}

// Passt den Laeufer an die Groesse der GLB-Tischplatte an. Die Geometrie ist
// 13,5 x 3,9 Einheiten gross; die Textur wird dabei leicht gestreckt.
export function fitRunnerToTable(tableWidth, tableDepth) {
  if (!runner) return;
  runner.scale.x = Math.min(1, (tableWidth * 0.92) / 13.5);
  runner.scale.y = Math.min(1, (tableDepth * 0.5) / 3.9);
}

export function addBauble(x, z, radius, material) {
  const group = new THREE.Group();
  group.position.set(x, CONFIG.tableY, z);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material);
  ball.position.y = radius;
  ball.castShadow = true;
  ball.receiveShadow = true;
  group.add(ball);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.13, radius * 0.13, radius * 0.16, 10),
    materials.gold,
  );
  cap.position.y = radius * 2.02;
  group.add(cap);

  const loop = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.12, radius * 0.025, 6, 16),
    materials.gold,
  );
  loop.position.y = radius * 2.16;
  loop.rotation.x = Math.PI / 2;
  group.add(loop);

  scene.add(group);
}

// Stilisierter Tannenzweig: duenne Kegel als Nadeln, flach auf dem Tisch.
export function addFirSprig() {
  const needleGeometry = new THREE.ConeGeometry(0.016, 0.26, 4);
  needleGeometry.translate(0, 0.13, 0);
  const count = 76;
  const needles = new THREE.InstancedMesh(needleGeometry, materials.fir, count);
  needles.castShadow = false;
  needles.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const side = i % 2 === 0 ? 1 : -1;
    dummy.position.set(
      -5.25 + t * 1.55 + rand(-0.04, 0.04),
      CONFIG.tableY + 0.018 + rand(0, 0.012),
      1.55 + Math.sin(t * Math.PI) * 0.12 + rand(-0.05, 0.05),
    );
    dummy.rotation.set(
      -Math.PI / 2 + rand(-0.18, 0.18),
      rand(-0.2, 0.2),
      side * rand(0.65, 1.15),
    );
    dummy.scale.setScalar(rand(0.7, 1.25));
    dummy.updateMatrix();
    needles.setMatrixAt(i, dummy.matrix);
  }
  needles.instanceMatrix.needsUpdate = true;
  scene.add(needles);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.02, 1.6, 5),
    materials.fir,
  );
  stem.rotation.z = Math.PI / 2;
  stem.rotation.y = 0.04;
  stem.position.set(-4.48, CONFIG.tableY + 0.02, 1.55);
  scene.add(stem);
}

let dust;
export function createDust() {
  const count = 140;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = rand(-7, 7);
    positions[i * 3 + 1] = CONFIG.tableY + rand(0.1, 4.5);
    positions[i * 3 + 2] = rand(-3.5, 4.5);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dust = new THREE.Points(geometry, new THREE.PointsMaterial({
    map: textures.soft,
    color: 0xffd7a0,
    size: 0.032,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }));
  dust.frustumCulled = false;
  scene.add(dust);
}

let bokeh;
export function createBokeh() {
  const count = 70;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const x = rand(-10, 10);
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = CONFIG.tableY + 2.4 + Math.sin(x * 0.55) * 0.9 + rand(-0.85, 0.85);
    positions[i * 3 + 2] = rand(-7.5, -3.5);
    const hue = rand(0.07, 0.13);
    const warm = Math.random() > 0.16;
    color.setHSL(warm ? hue : rand(0.0, 0.02), warm ? 0.72 : 0.55, warm ? 0.62 : 0.36);
    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  bokeh = new THREE.Points(geometry, new THREE.PointsMaterial({
    map: textures.soft,
    vertexColors: true,
    size: 0.3,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    fog: false,
  }));
  bokeh.frustumCulled = false;
  scene.add(bokeh);
}

// Staub und Bokeh reagieren auf Wind und Zeit.
export function updateDust(dt) {
  if (!dust) return;
  const positions = dust.geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] += (0.012 + (i % 9) * 0.0025) * dt;
    positions[i + 0] += state.wind.x * 0.022 * dt;
    positions[i + 2] += state.wind.z * 0.022 * dt;
    if (positions[i + 1] > CONFIG.tableY + 4.8) {
      positions[i + 1] = CONFIG.tableY + 0.1;
      positions[i + 0] = rand(-7, 7);
      positions[i + 2] = rand(-3.5, 4.5);
    }
  }
  dust.geometry.attributes.position.needsUpdate = true;
}

export function updateBokeh(time) {
  if (!bokeh) return;
  bokeh.material.opacity = 0.62 + Math.sin(time * 0.65) * 0.1;
}
