import * as THREE from "three";
import * as CONFIG from "./config.js";
import { loadLetters, loadScene } from "./model.js";
import { burnHeight, updateLetter, wickHeight } from "./heat.js";
import { createBreakage, checkBreaks } from "./breakage.js";
import { breakOff, updatePieces, releaseUnsupported } from "./pieces.js";
import { createDropSystem } from "./drops.js";
import { createFlame } from "./flame.js";
import { createTable } from "./table.js";
import { createSurface, updateSurface } from "./surface.js";

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

// createTable(scene);
const loadedScene = await loadScene();
loadedScene.position.set(...CONFIG.SCENE_POSITION);
loadedScene.scale.setScalar(CONFIG.SCENE_SCALE);
scene.add(loadedScene);

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
  return { letter, breakage: createBreakage(letter), flame: createFlame(scene), surface: createSurface(letter), pieces: [], supportTimer: 0 };
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
  for (const candle of candles) updateCandle(candle, wasBurning, dt, burnDt);
  drops.update(dt, burnDt);
  renderer.render(scene, camera);
  updateHud(frameSeconds);
});

function updateCandle(candle, wasBurning, dt, burnDt) {
  const { letter, flame, surface, pieces } = candle;
  letter.burning = burnSeconds < CONFIG.BURN_SECONDS;
  const piecesFalling = pieces.some((piece) => !piece.landed);
  if (!wasBurning && !piecesFalling) return;
  const burn = burnHeight(letter, burnSeconds);
  updatePieces(letter, pieces, surface, dt);
  updateLetter(letter, burn, burnDt);
  if (wasBurning) checkSupport(candle, burn, burnDt);
  updateSurface(surface, letter);
  if (!letter.burning) {
    flame.extinguish();
    return;
  }
  flame.setPosition(letter.wick.x, wickHeight(burn), letter.wick.z);
  flame.update(clock.elapsedTime);
}

function checkSupport(candle, burn, burnDt) {
  const { letter, breakage, surface, pieces } = candle;
  candle.supportTimer += burnDt;
  if (candle.supportTimer < CONFIG.SUPPORT_CHECK_SECONDS) return;
  candle.supportTimer = 0;
  const piecesBefore = pieces.length;
  for (const cells of checkBreaks(letter, breakage, burn)) {
    const piece = breakOff(letter, breakage, cells, burn);
    if (piece) pieces.push(piece);
  }
  if (pieces.length > piecesBefore) releaseUnsupported(letter, pieces, surface);
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
