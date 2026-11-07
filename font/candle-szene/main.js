import * as THREE from "three";
import * as CONFIG from "./config.js";
import { loadLetters } from "./model.js";
import { burnHeight, updateLetter, wickHeight } from "./heat.js";
import { createBreakage, takeBrokenPieces } from "./breakage.js";
import { createDropSystem } from "./drops.js";
import { createFlame } from "./flame.js";
import { createTable } from "./table.js";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

// PHYSICS: Backend wird über CONFIG.PHYSICS_BACKEND gewählt, beide Module haben dieselbe Schnittstelle
const { createPhysics } = await import(`./physics/${CONFIG.PHYSICS_BACKEND}.js`);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.BACKGROUND_COLOR);
scene.add(new THREE.HemisphereLight(CONFIG.AMBIENT_SKY, CONFIG.AMBIENT_GROUND, CONFIG.AMBIENT_INTENSITY));
const fillLight = new THREE.DirectionalLight(CONFIG.FILL_COLOR, CONFIG.FILL_INTENSITY);
fillLight.position.set(...CONFIG.FILL_POSITION);
scene.add(fillLight);

const camera = new THREE.PerspectiveCamera(CONFIG.CAMERA_FOV, innerWidth / innerHeight, 0.05, 50);
camera.position.set(...CONFIG.CAMERA_POSITION);
camera.lookAt(...CONFIG.CAMERA_TARGET);

createTable(scene);

const waxMaterial = new THREE.MeshPhysicalMaterial({
  vertexColors: true,
  roughness: 0.45,
  sheen: 0.6,
  sheenColor: new THREE.Color(0xffe2b0),
  side: THREE.DoubleSide,
});
const letters = await loadLetters(waxMaterial);
const physics = createPhysics({ gravity: CONFIG.GRAVITY, tableY: CONFIG.TABLE_Y });
const candles = letters.map((letter) => {
  scene.add(letter.mesh);
  updateLetter(letter, letter.top);
  return { letter, breakage: createBreakage(letter), flame: createFlame(scene) };
});
const drops = createDropSystem(scene, physics, letters);

const clock = new THREE.Clock();
const hud = document.getElementById("hud");
let burnSeconds = 0;
let timeFactor = 1;
let chunkCount = 0;
let fpsFrames = 0;
let fpsSeconds = 0;

addEventListener("keydown", (event) => {
  if (event.key === "f") timeFactor = timeFactor === 1 ? CONFIG.FAST_FACTOR : 1;
  if (event.key === "r") location.reload();
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), CONFIG.MAX_FRAME_SECONDS);
  const burnDt = dt * timeFactor;
  const wasBurning = burnSeconds < CONFIG.BURN_SECONDS;
  burnSeconds += burnDt;
  for (const candle of candles) updateCandle(candle, wasBurning);
  drops.update(dt, burnDt);
  physics.step(dt);
  renderer.render(scene, camera);
  updateHud(dt);
});

function updateCandle({ letter, breakage, flame }, wasBurning) {
  letter.burning = burnSeconds < CONFIG.BURN_SECONDS;
  if (!wasBurning) return;
  const burn = burnHeight(letter, burnSeconds);
  updateLetter(letter, burn);
  for (const piece of takeBrokenPieces(letter, breakage, burn)) dropChunk(piece);
  if (!letter.burning) {
    flame.extinguish();
    return;
  }
  flame.setPosition(letter.wick.x, wickHeight(burn), letter.wick.z);
  flame.update(clock.elapsedTime);
}

function dropChunk(piece) {
  if (chunkCount >= CONFIG.MAX_CHUNKS) return;
  const size = piece.geometry.boundingBox.getSize(new THREE.Vector3());
  if (Math.min(size.x, size.y) < CONFIG.MIN_CHUNK_SIZE) return;
  const chunk = new THREE.Mesh(solidGeometry(piece.geometry), waxMaterial);
  chunk.position.copy(piece.center);
  scene.add(chunk);
  physics.addChunk(chunk);
  chunkCount++;
}

function solidGeometry(shell) {
  const positions = shell.getAttribute("position");
  const colors = shell.getAttribute("color");
  const points = [];
  const average = new THREE.Color(0, 0, 0);
  for (let i = 0; i < positions.count; i++) {
    points.push(new THREE.Vector3().fromBufferAttribute(positions, i));
    average.r += colors.getX(i) / positions.count;
    average.g += colors.getY(i) / positions.count;
    average.b += colors.getZ(i) / positions.count;
  }
  const solid = new ConvexGeometry(points);
  const solidColors = new Float32Array(solid.getAttribute("position").count * 3);
  for (let i = 0; i < solidColors.length; i += 3) average.toArray(solidColors, i);
  solid.setAttribute("color", new THREE.BufferAttribute(solidColors, 3));
  solid.computeBoundingBox();
  return solid;
}

function updateHud(dt) {
  fpsFrames++;
  fpsSeconds += dt;
  if (fpsSeconds < 0.5) return;
  const fps = Math.round(fpsFrames / fpsSeconds);
  const remaining = Math.max(0, CONFIG.BURN_SECONDS - burnSeconds).toFixed(0);
  hud.textContent = `${fps} FPS · ${timeFactor}× · Physik: ${CONFIG.PHYSICS_BACKEND} · noch ${remaining} s · [F] schneller · [R] neu`;
  fpsFrames = 0;
  fpsSeconds = 0;
}
