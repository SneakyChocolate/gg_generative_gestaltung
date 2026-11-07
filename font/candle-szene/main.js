import * as THREE from "three";
import * as CONFIG from "./config.js";
import { loadLetters } from "./model.js";
import { burnHeight, updateLetter, wickHeight } from "./heat.js";
import { createBreakage, takeBrokenPieces } from "./breakage.js";
import { createDropSystem } from "./drops.js";
import { createFlame } from "./flame.js";
import { createTable } from "./table.js";

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
const candles = letters.map((letter) => {
  scene.add(letter.mesh);
  updateLetter(letter, letter.top, 0);
  return { letter, breakage: createBreakage(letter), flame: createFlame(scene) };
});
const drops = createDropSystem(scene, letters);

const clock = new THREE.Clock();
const hud = document.getElementById("hud");
let burnSeconds = 0;
let timeFactor = 1;
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
  const frameSeconds = clock.getDelta();
  const dt = Math.min(frameSeconds, CONFIG.MAX_FRAME_SECONDS);
  const burnDt = dt * timeFactor;
  const wasBurning = burnSeconds < CONFIG.BURN_SECONDS;
  burnSeconds += burnDt;
  for (const candle of candles) updateCandle(candle, wasBurning, burnDt);
  drops.update(dt, burnDt);
  renderer.render(scene, camera);
  updateHud(frameSeconds);
});

function updateCandle({ letter, breakage, flame }, wasBurning, burnDt) {
  letter.burning = burnSeconds < CONFIG.BURN_SECONDS;
  if (!wasBurning) return;
  const burn = burnHeight(letter, burnSeconds);
  updateLetter(letter, burn, burnDt);
  takeBrokenPieces(letter, breakage, burn);
  if (!letter.burning) {
    flame.extinguish();
    return;
  }
  flame.setPosition(letter.wick.x, wickHeight(burn), letter.wick.z);
  flame.update(clock.elapsedTime);
}

function updateHud(dt) {
  fpsFrames++;
  fpsSeconds += dt;
  if (fpsSeconds < 0.5) return;
  const fps = Math.round(fpsFrames / fpsSeconds);
  const remaining = Math.max(0, CONFIG.BURN_SECONDS - burnSeconds).toFixed(0);
  hud.textContent = `${fps} FPS · ${timeFactor}× · noch ${remaining} s · [F] schneller · [R] neu`;
  fpsFrames = 0;
  fpsSeconds = 0;
}
