import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from './config.js';
import { state } from './state.js';
import { scene, camera, renderer } from './renderer.js';
import {
  fitCamera,
  setupLights,
  setupEnvironment,
  setProceduralBaseVisible,
  fitRunnerToTable,
  updateDust,
  updateBokeh,
} from './environment.js';
import { loadEnvironmentScene } from './environmentScene.js';
import { loadModel } from './model.js';
import { initSmoke, updateSmoke } from './systems/smoke.js';
import { DropletSystem } from './systems/droplets.js';
import { PuddleSystem } from './systems/puddles.js';
import { ShardSystem } from './systems/shards.js';
import { setupInput } from './input.js';

// Aufbau, Reset, Debug und der pro Frame ausgefuehrte Simulationsschritt.

const loaderElement = document.getElementById('loader');
const debugElement = document.getElementById('debug');
const fadeElement = document.getElementById('fade');
const hudElement = document.getElementById('hud');
const subtitleElement = document.querySelector('.subtitle');

let composer = null;
let bloomPass = null;
let debugTimer = 0;
const clock = new THREE.Clock();

function setupComposer() {
  if (!CONFIG.bloom) return;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.34,
    0.64,
    0.84,
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  composer.setSize(window.innerWidth, window.innerHeight);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(width, height);
  if (composer) composer.setSize(width, height);
  fitCamera(state.model ? state.model.width : 8);
}

function updateWind(dt) {
  const smoothing = 1 - Math.exp(-CONFIG.wind.smooth * dt);
  state.wind.lerp(state.windTarget, smoothing);
}

function updateScene(dt) {
  state.elapsed += dt;
  state.normalFrame++;
  updateWind(dt);

  // Reihenfolge: erst die Dochte (Hitzequelle bewegen), dann die
  // Buchstaben (Temperatur + Schmelze), dann die Wachssysteme.
  for (const wick of state.wicks) {
    wick.update(dt, state.time, state.elapsed);
  }
  for (const part of state.parts) {
    part.update(dt);
  }

  // Bruch: heisse, duenne Stellen verlieren ihre Stabilitaet. canBreak()
  // prueft Cooldown, Gewicht und ob ueberhaupt genug Wachs geschmolzen ist.
  for (const part of state.parts) {
    if (!part.canBreak()) continue;
    state.shards.spawn(part);
  }

  state.drops.update(dt);
  state.puddles.update(dt);
  state.shards.update(dt);
  updateSmoke(dt);
  updateDust(dt);
  updateBokeh(state.time);

  if (state.elapsed > CONFIG.loopSeconds && !state.resetting) {
    requestReset();
  }
}

function requestReset() {
  if (state.resetting) return;
  state.resetting = true;
  fadeElement.style.opacity = '1';
  window.setTimeout(() => {
    resetScene();
    fadeElement.style.opacity = '0';
    state.resetting = false;
  }, 1150);
}

function resetScene() {
  state.elapsed = 0;
  state.time = 0;
  state.normalFrame = 0;
  state.smokeTimer = 0;
  state.wind.set(0, 0, 0);
  state.windTarget.set(0, 0, 0);

  for (const part of state.parts) part.reset();
  for (const wick of state.wicks) wick.reset();
  state.drops.clear();
  state.puddles.clear();
  state.shards.clear();

  for (const puff of state.smoke) {
    puff.life = 0;
    puff.sprite.visible = false;
    puff.material.opacity = 0;
  }
}

function renderFrame() {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

function updateFps(rawDt) {
  state.fpsFrames++;
  state.fpsTime += rawDt;
  if (state.fpsTime >= 0.5) {
    state.fps = state.fpsFrames / state.fpsTime;
    state.fpsFrames = 0;
    state.fpsTime = 0;
  }
}

function updateDebug(rawDt) {
  if (!debugElement.classList.contains('visible')) return;
  debugTimer -= rawDt;
  if (debugTimer > 0) return;
  debugTimer = 0.22;

  const vertices = state.parts.reduce((sum, part) => sum + part.count, 0);
  const activeWicks = state.wicks.filter((wick) => wick.active).length;
  const lines = [
    `FPS        ${state.fps.toFixed(1)}`,
    `Modell     ${state.model ? state.model.kind : '-'} · ${state.parts.length} Teile · ${vertices} Vertices`,
    `Physik     ${CONFIG.physicsMode}`,
    `Tropfen    ${state.drops ? state.drops.drops.length : 0}`,
    `Pfuetzen   ${state.puddles ? state.puddles.puddles.length : 0}`,
    `Splitter   ${state.shards ? state.shards.shards.length : 0}`,
    `Dochte     ${activeWicks}/${state.wicks.length}`,
    `Zeit       ${state.elapsed.toFixed(1)} / ${CONFIG.loopSeconds} s`,
    '',
    'Kraefte: Schwerkraft · Luftwiderstand · Wind',
    '         Waerme · Oberflaechenspannung · Kollision',
  ];
  debugElement.textContent = lines.join('\n');
}

// Wird von draw() in sketch.js einmal pro Frame aufgerufen.
export function frame() {
  const rawDt = Math.min(clock.getDelta(), 0.05);
  if (!state.ready) return;

  if (!state.paused && !state.resetting) {
    updateScene(rawDt);
    state.time += rawDt;
  }

  renderFrame();
  updateFps(rawDt);
  updateDebug(rawDt);
}

function showFatalError(error) {
  console.error(error);
  loaderElement.classList.remove('done');
  loaderElement.innerHTML = `
    <p class="error">
      Die Szene konnte nicht gestartet werden.<br><br>
      ${String(error && error.message ? error.message : error)}
      <br><br>
      Bitte die Seite ueber einen lokalen Server oeffnen
      (z.&nbsp;B. <code>python3 -m http.server</code>) und die Internetverbindung pruefen.
    </p>
  `;
}

export async function init() {
  try {
    setupLights();
    setupEnvironment();
    initSmoke();

    const model = await loadModel();
    state.model = model;
    state.parts = model.parts;
    state.wicks = model.wicks;
    scene.add(model.group);
    model.group.position.y = CONFIG.tableY;

    // Die GLB-Umgebung liefert Tisch und Hintergrund. Schlaegt das Laden
    // fehl, bleibt die prozedurale Umgebung sichtbar und die Szene laeuft.
    try {
      const environment = await loadEnvironmentScene(model.width);
      if (environment) {
        setProceduralBaseVisible(false);
        fitRunnerToTable(environment.tableSize.x, environment.tableSize.z);
      }
    } catch (error) {
      console.warn(
        'GLB-Umgebung konnte nicht geladen werden; prozedurale Umgebung bleibt aktiv.',
        error,
      );
    }

    state.puddles = new PuddleSystem();
    state.puddles.configureBounds(model.width);
    state.drops = new DropletSystem();
    state.shards = new ShardSystem();

    fitCamera(model.width);
    setupComposer();

    state.ready = true;
    loaderElement.classList.add('done');
    window.setTimeout(() => loaderElement.remove(), 1000);
    clock.getDelta();
  } catch (error) {
    showFatalError(error);
  }
}

// =====================================================================
//  EINGABE
// =====================================================================

window.addEventListener('resize', onResize);

setupInput({
  requestReset,
  clock,
  subtitleElement,
  debugElement,
  hudElement,
});

// Kleine, harmlose Debug-Schnittstelle fuer die Entwicklung. Sie erlaubt
// es, den Zustand im Browser ohne DevTools zu pruefen.
window.__CANDLE__ = { state, CONFIG, scene, camera, renderer, THREE };
window.__CANDLE_ERRORS__ = [];
window.addEventListener('error', (event) => {
  window.__CANDLE_ERRORS__.push(String(event.message || event.error || event));
});
window.addEventListener('unhandledrejection', (event) => {
  window.__CANDLE_ERRORS__.push(String(event.reason || event));
});
