# Kerze „ZEIT" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browser-Szene, in der das Wort ZEIT als 3D-Wachskerze mit vier Dochten abbrennt, schmilzt, tropft (verschmelzende Metaball-Tropfen), Stücke verliert und Wachs auf einer Tischebene sammelt.

**Architecture:** ES-Module ohne Build. `model.js` liefert pro Buchstabe ein verdichtetes, indiziertes Mesh plus Docht; `grid.js` rastert den Buchstaben in XY-Zellen (Wachssäulen); `heat.js` verformt und färbt Vertices pro Frame relativ zum eigenen Docht; `breakage.js` löst hängende, dünn gewordene Säulen als Brocken ab; `drops.js` verwaltet Tropfen und rendert sie pro Buchstabe mit `MarchingCubes`; zwei austauschbare Physik-Backends mit identischer Schnittstelle.

**Tech Stack:** three@0.160.0 (importmap von jsDelivr, Addons `three/addons/…`), cannon-es@0.20.0, Python `http.server` zum Ausliefern, Headless Chrome für `verify.html` und Screenshot.

**Spec:** `docs/superpowers/specs/2026-11-07-candle-szene-design.md`

**Projektregeln:**
- Keine Kommentare außer Markern `// CONFIG:`, `// MODEL:`, `// PHYSICS:`, `// TABLE:`.
- Kein Commit, solange der User nicht explizit danach fragt (globale User-Regel, Branch ist `master`).

---

## Dateistruktur

```
font/candle-szene/
  index.html          Szene-Seite, importmap
  verify.html         Testseite, gleiche importmap
  verify.js           Asserts, schreibt PASS/FAIL in DOM + <title>
  config.js           alle Konstanten
  grid.js             XY-Zellraster, Säulenböden, Dochtspalte
  heat.js             Temperatur, Brennhöhe, Wachsfarbe, Vertex-Update
  model.js            Text / glTF / Fallback laden, verdichten, Letter-Objekte
  breakage.js         hängende Säulen erkennen und als Brocken ausschneiden
  drops.js            Tropfen spawnen, gleiten, mergen, MarchingCubes-Rendering
  physics/own.js      eigene Euler-Physik
  physics/cannon.js   cannon-es-Backend
  flame.js            Sprite-Flamme + PointLight
  table.js            Platzhalter-Tisch
  main.js             Szene, Loop, Tasten, HUD
  README.md           Architektur-Übersicht
```

## Gemeinsame Befehle

Server (einmal, im Hintergrund laufen lassen):

```bash
cd font/candle-szene && python3 -m http.server 8765
```

Tests:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --virtual-time-budget=20000 --dump-dom http://localhost:8765/verify.html | grep -E "<title>|PASS|FAIL|info"
```

Erwartung bei Erfolg: `<title>PASS</title>` und nur `PASS`-Zeilen. Bei Import-Fehler fehlt der Titel `PASS` (bleibt `verify`).

---

### Task 1: Gerüst, Config, Test-Harness

**Files:**
- Create: `font/candle-szene/index.html`
- Create: `font/candle-szene/verify.html`
- Create: `font/candle-szene/verify.js`
- Create: `font/candle-szene/config.js`

- [ ] **Step 1: `config.js` anlegen**

```js
// CONFIG: Modellquelle "text" | "gltf" | "fallback"
export const MODEL_SOURCE = "text";
export const WORD = "ZEIT";
export const FONT_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json";
// CONFIG: Blender-Export, wird bei MODEL_SOURCE = "gltf" geladen, ein Mesh pro Buchstabe
export const GLTF_URL = "./models/zeit.glb";
export const LETTER_SIZE = 1;
export const LETTER_DEPTH = 0.33;
export const LETTER_GAP = 0.18;
export const BEVEL = 0.025;
export const TESSELLATE_EDGE = 0.05;
export const TESSELLATE_ITERATIONS = 10;
export const CELL_SIZE = 0.1;

// PHYSICS: "own" (eigene Euler-Physik) | "cannon" (cannon-es)
export const PHYSICS_BACKEND = "own";
export const GRAVITY = -3;
// TABLE: Oberkante des Tisches, der Partner-Tisch muss auf dieser Höhe liegen
export const TABLE_Y = 0;

export const BURN_SECONDS = 120;
export const FAST_FACTOR = 4;
export const MAX_FRAME_SECONDS = 0.05;
export const HEAT_RADIUS = 0.45;
export const CRATER = 2.5;
export const SAG = 0.05;

export const BREAK_THICKNESS = 0.05;
export const HEAT_WEAKENING = 0.8;
export const MAX_CHUNKS = 40;

export const DROP_INTERVAL = 0.5;
export const DROP_MIN_R = 0.045;
export const DROP_MAX_R = 0.075;
export const DROP_MIN_TEMPERATURE = 0.3;
export const DROP_MAX_TEMPERATURE = 0.85;
export const SLIDE_SPEED = 0.15;
export const COOL_SECONDS = 10;
export const MAX_DROPS_PER_LETTER = 30;
export const PUDDLE_SPREAD = 2;
export const PUDDLE_SINK = 0.8;
export const MC_RESOLUTION = 48;
export const MC_SUBTRACT = 12;
export const POOL_MARGIN = 0.15;

export const WAX_COLD = 0xf2e8d5;
export const WAX_WARM = 0xffd27a;
export const WAX_HOT = 0xff6a1f;
export const FLAME_LIGHT = 1.5;
export const BACKGROUND_COLOR = 0x07050a;
export const AMBIENT_SKY = 0x8a94b8;
export const AMBIENT_GROUND = 0x1a120c;
export const AMBIENT_INTENSITY = 0.2;
export const CAMERA_FOV = 40;
export const CAMERA_POSITION = [0, 1.3, 3.8];
export const CAMERA_TARGET = [0, 0.45, 0];
```

- [ ] **Step 2: `index.html` anlegen**

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>ZEIT</title>
  <style>
    html, body { margin: 0; overflow: hidden; background: #07050a; }
    canvas { display: block; }
    #hud { position: fixed; top: 8px; left: 10px; font: 12px monospace; color: #c9b79c; }
  </style>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
      "cannon-es": "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js"
    }
  }
  </script>
</head>
<body>
  <div id="hud"></div>
  <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 3: `verify.html` anlegen**

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>verify</title>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
      "cannon-es": "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js"
    }
  }
  </script>
</head>
<body>
  <pre id="out"></pre>
  <script type="module" src="verify.js"></script>
</body>
</html>
```

- [ ] **Step 4: `verify.js` Harness anlegen**

Neue Tests kommen immer zwischen die Markierung `TESTS` und den Abschluss; neue Imports oben dazu.

```js
import * as THREE from "three";
import * as CONFIG from "./config.js";

const lines = [];
let failures = 0;

function check(name, ok) {
  if (!ok) failures++;
  lines.push(`${ok ? "PASS" : "FAIL"} ${name}`);
}

function near(a, b, tolerance = 1e-6) {
  return Math.abs(a - b) < tolerance;
}

check("harness: three geladen", typeof THREE.Vector3 === "function");
check("harness: config geladen", CONFIG.WORD === "ZEIT");

document.getElementById("out").textContent = lines.join("\n");
document.title = failures ? `FAIL ${failures}` : "PASS";
```

- [ ] **Step 5: Server starten und Tests laufen lassen**

Server-Befehl (Hintergrund) und Test-Befehl aus „Gemeinsame Befehle".
Expected: `<title>PASS</title>`, zwei PASS-Zeilen.

---

### Task 2: Zellraster (`grid.js`)

**Files:**
- Create: `font/candle-szene/grid.js`
- Modify: `font/candle-szene/verify.js`

- [ ] **Step 1: Failing Test schreiben**

Import oben in `verify.js`:

```js
import { buildGrid, cellIndex, floorOf, tallestColumnX } from "./grid.js";
```

Vor `document.getElementById("out")…` einfügen:

```js
const gridPoints = [];
for (let y = 0; y <= 1.0001; y += 0.02) gridPoints.push(0.05, y, 0);
for (let y = 0.62; y <= 1.0001; y += 0.02) gridPoints.push(0.55, y, 0);
const testGrid = buildGrid(new Float32Array(gridPoints));
check("grid: stehende Säule beginnt auf 0", near(floorOf(testGrid, cellIndex(testGrid, 0.05, 0.9)), 0));
check("grid: hängende Säule beginnt über 0.5", floorOf(testGrid, cellIndex(testGrid, 0.55, 0.9)) > 0.5);
check("grid: Docht über höchster Säule", Math.abs(tallestColumnX(testGrid) - 0.1) < CONFIG.CELL_SIZE);
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Expected: Titel nicht `PASS` (Modul `grid.js` fehlt).

- [ ] **Step 3: `grid.js` implementieren**

```js
import { CELL_SIZE } from "./config.js";

export function buildGrid(positions) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
  }
  const cols = Math.floor((maxX - minX) / CELL_SIZE) + 1;
  const rows = Math.floor((maxY - minY) / CELL_SIZE) + 1;
  const grid = { minX, minY, cols, rows, filled: new Uint8Array(cols * rows), runStart: new Int32Array(cols * rows) };
  for (let i = 0; i < positions.length; i += 3) {
    grid.filled[cellIndex(grid, positions[i], positions[i + 1])] = 1;
  }
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const index = row * cols + col;
      const below = index - cols;
      const startsRun = row === 0 || !grid.filled[below];
      grid.runStart[index] = startsRun ? index : grid.runStart[below];
    }
  }
  return grid;
}

export function cellIndex(grid, x, y) {
  const col = Math.min(grid.cols - 1, Math.max(0, Math.floor((x - grid.minX) / CELL_SIZE)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor((y - grid.minY) / CELL_SIZE)));
  return row * grid.cols + col;
}

export function cellCenter(grid, index) {
  return {
    x: grid.minX + ((index % grid.cols) + 0.5) * CELL_SIZE,
    y: grid.minY + (Math.floor(index / grid.cols) + 0.5) * CELL_SIZE,
  };
}

export function floorOf(grid, index) {
  return grid.minY + Math.floor(grid.runStart[index] / grid.cols) * CELL_SIZE;
}

export function tallestColumnX(grid) {
  const middle = (grid.cols - 1) / 2;
  let bestCol = 0;
  let bestScore = -Infinity;
  for (let col = 0; col < grid.cols; col++) {
    let filledCells = 0;
    for (let row = 0; row < grid.rows; row++) filledCells += grid.filled[row * grid.cols + col];
    const score = filledCells - 0.5 * Math.abs(col - middle);
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }
  return grid.minX + (bestCol + 0.5) * CELL_SIZE;
}
```

- [ ] **Step 4: Tests laufen lassen**

Expected: `<title>PASS</title>`, drei neue `grid:`-Zeilen PASS.

---

### Task 3: Hitze-Funktionen (`heat.js`)

**Files:**
- Create: `font/candle-szene/heat.js`
- Modify: `font/candle-szene/verify.js`

- [ ] **Step 1: Failing Test schreiben**

Import:

```js
import { temperatureAt, burnHeight, wickHeight, waxColor, updateLetter } from "./heat.js";
```

Tests:

```js
check("heat: am Docht heiß", temperatureAt(0) === 1);
check("heat: am Rand kalt", temperatureAt(CONFIG.HEAT_RADIUS) === 0);
check("heat: fällt mit Abstand", temperatureAt(0.1) > temperatureAt(0.2));
const fakeLetter = { top: 1, bottom: -0.5 };
check("heat: Brennhöhe Start = Oberkante", near(burnHeight(fakeLetter, 0), 1));
check("heat: Brennhöhe Ende = Unterkante", near(burnHeight(fakeLetter, CONFIG.BURN_SECONDS), -0.5));
check("heat: Docht nie unter Tisch", wickHeight(-0.5) === CONFIG.TABLE_Y);
check("heat: heißes Wachs röter als kaltes", waxColor(1, new THREE.Color()).b < waxColor(0, new THREE.Color()).b);
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Expected: Titel nicht `PASS`.

- [ ] **Step 3: `heat.js` implementieren**

```js
import * as THREE from "three";
import { HEAT_RADIUS, CRATER, SAG, BURN_SECONDS, TABLE_Y, WAX_COLD, WAX_WARM, WAX_HOT } from "./config.js";

const coldWax = new THREE.Color(WAX_COLD);
const warmWax = new THREE.Color(WAX_WARM);
const hotWax = new THREE.Color(WAX_HOT);
const vertexColor = new THREE.Color();

export function temperatureAt(distance) {
  return Math.min(1, Math.max(0, 1 - distance / HEAT_RADIUS));
}

export function burnHeight(letter, seconds) {
  const progress = Math.min(1, Math.max(0, seconds / BURN_SECONDS));
  return letter.top + (letter.bottom - letter.top) * progress;
}

export function wickHeight(burn) {
  return Math.max(TABLE_Y, burn);
}

export function waxColor(temperature, target) {
  return temperature < 0.5
    ? target.lerpColors(coldWax, warmWax, temperature * 2)
    : target.lerpColors(warmWax, hotWax, temperature * 2 - 1);
}

export function updateLetter(letter, burn) {
  const geometry = letter.mesh.geometry;
  const positions = geometry.getAttribute("position");
  const colors = geometry.getAttribute("color");
  const { rest, floors, temperatures, wick } = letter;
  const wickY = wickHeight(burn);
  for (let vertex = 0; vertex < temperatures.length; vertex++) {
    const i = vertex * 3;
    const dx = rest[i] - wick.x;
    const dz = rest[i + 2] - wick.z;
    const horizontalSquared = dx * dx + dz * dz;
    const capped = Math.min(rest[i + 1], burn + CRATER * horizontalSquared);
    const dy = capped - wickY;
    const temperature = temperatureAt(Math.sqrt(horizontalSquared + dy * dy));
    temperatures[vertex] = temperature;
    positions.array[i + 1] = Math.max(floors[vertex], capped - SAG * temperature * temperature);
    waxColor(temperature, vertexColor);
    colors.array[i] = vertexColor.r;
    colors.array[i + 1] = vertexColor.g;
    colors.array[i + 2] = vertexColor.b;
  }
  positions.needsUpdate = true;
  colors.needsUpdate = true;
  geometry.computeVertexNormals();
}
```

- [ ] **Step 4: Tests laufen lassen**

Expected: `<title>PASS</title>`, sieben neue `heat:`-Zeilen PASS.

---

### Task 4: Eigene Physik (`physics/own.js`)

**Files:**
- Create: `font/candle-szene/physics/own.js`
- Modify: `font/candle-szene/verify.js`

- [ ] **Step 1: Failing Test schreiben**

Tests (kein statischer Import nötig, Backend wird dynamisch geladen):

```js
for (const backend of ["own"]) {
  const { createPhysics } = await import(`./physics/${backend}.js`);
  const physics = createPhysics({ gravity: CONFIG.GRAVITY, tableY: CONFIG.TABLE_Y });
  const body = physics.addDrop(new THREE.Vector3(0, CONFIG.TABLE_Y + 1, 0), 0.05, new THREE.Vector3());
  for (let i = 0; i < 180; i++) physics.step(1 / 60);
  check(`physics ${backend}: Tropfen fällt nicht durch Tisch`, physics.position(body).y >= CONFIG.TABLE_Y + 0.04);
  check(`physics ${backend}: Tropfen ist gelandet`, physics.position(body).y < CONFIG.TABLE_Y + 0.1);
  check(`physics ${backend}: Tropfen liegt still`, physics.isResting(body));
}
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Expected: Titel nicht `PASS`.

- [ ] **Step 3: `physics/own.js` implementieren**

```js
import * as THREE from "three";

export function createPhysics({ gravity, tableY }) {
  const bodies = new Set();

  function add(position, radius, velocity, mesh = null, spin = null) {
    const body = { position: position.clone(), velocity: velocity.clone(), radius, mesh, spin, resting: false };
    bodies.add(body);
    return body;
  }

  return {
    addDrop: (position, radius, velocity) => add(position, radius, velocity),
    addChunk(mesh) {
      mesh.geometry.computeBoundingSphere();
      const velocity = new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.6), 0.4, THREE.MathUtils.randFloat(0.3, 0.6));
      const spin = new THREE.Vector3().randomDirection().multiplyScalar(4);
      return add(mesh.position, mesh.geometry.boundingSphere.radius * 0.5, velocity, mesh, spin);
    },
    remove: (body) => bodies.delete(body),
    step(dt) {
      for (const body of bodies) {
        if (body.resting) continue;
        body.velocity.y += gravity * dt;
        body.position.addScaledVector(body.velocity, dt);
        if (body.position.y - body.radius <= tableY) {
          body.position.y = tableY + body.radius;
          body.velocity.set(0, 0, 0);
          body.resting = true;
        }
        if (body.mesh) {
          body.mesh.position.copy(body.position);
          body.mesh.rotation.x += body.spin.x * dt;
          body.mesh.rotation.y += body.spin.y * dt;
          body.mesh.rotation.z += body.spin.z * dt;
        }
      }
    },
    position: (body) => body.position,
    velocity: (body) => body.velocity,
    isResting: (body) => body.resting,
  };
}
```

- [ ] **Step 4: Tests laufen lassen**

Expected: `<title>PASS</title>`, drei `physics own:`-Zeilen PASS.

---

### Task 5: cannon-es-Backend (`physics/cannon.js`)

**Files:**
- Create: `font/candle-szene/physics/cannon.js`
- Modify: `font/candle-szene/verify.js`

- [ ] **Step 1: Test auf beide Backends erweitern**

In `verify.js` die Zeile

```js
for (const backend of ["own"]) {
```

ersetzen durch

```js
for (const backend of ["own", "cannon"]) {
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Expected: Titel nicht `PASS` (`physics/cannon.js` fehlt).

- [ ] **Step 3: `physics/cannon.js` implementieren**

```js
import * as CANNON from "cannon-es";
import * as THREE from "three";

export function createPhysics({ gravity, tableY }) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, gravity, 0) });
  world.defaultContactMaterial.restitution = 0;
  world.defaultContactMaterial.friction = 0.9;
  const table = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  table.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  table.position.y = tableY;
  world.addBody(table);
  const meshes = new Map();

  return {
    addDrop(position, radius, velocity) {
      const body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(radius), linearDamping: 0.6, angularDamping: 0.99 });
      body.position.set(position.x, position.y, position.z);
      body.velocity.set(velocity.x, velocity.y, velocity.z);
      world.addBody(body);
      return body;
    },
    addChunk(mesh) {
      mesh.geometry.computeBoundingBox();
      const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
      const body = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)) });
      body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
      body.velocity.set(THREE.MathUtils.randFloatSpread(0.6), 0.4, THREE.MathUtils.randFloat(0.3, 0.6));
      body.angularVelocity.set(THREE.MathUtils.randFloatSpread(6), THREE.MathUtils.randFloatSpread(6), THREE.MathUtils.randFloatSpread(6));
      world.addBody(body);
      meshes.set(body, mesh);
      return body;
    },
    remove(body) {
      world.removeBody(body);
      meshes.delete(body);
    },
    step(dt) {
      world.step(1 / 60, dt, 3);
      for (const [body, mesh] of meshes) {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
      }
    },
    position: (body) => body.position,
    velocity: (body) => body.velocity,
    isResting: (body) => body.position.y - body.boundingRadius <= tableY + 0.01 && body.velocity.lengthSquared() < 0.01,
  };
}
```

- [ ] **Step 4: Tests laufen lassen**

Expected: `<title>PASS</title>`, je drei Zeilen für `physics own:` und `physics cannon:` PASS.

---

### Task 6: Modell-Loader (`model.js`)

**Files:**
- Create: `font/candle-szene/model.js`
- Modify: `font/candle-szene/verify.js`

- [ ] **Step 1: Failing Test schreiben**

Import:

```js
import { loadLetters } from "./model.js";
```

Tests:

```js
const letters = await loadLetters(new THREE.MeshBasicMaterial());
lines.push(`info: Vertices pro Buchstabe ${letters.map((letter) => letter.temperatures.length).join(", ")}`);
check("model: ein Mesh pro Buchstabe", letters.length === CONFIG.WORD.length);
check("model: Docht liegt über dem Buchstaben", letters.every((letter) => letter.wick.x >= letter.box.min.x && letter.wick.x <= letter.box.max.x));
check("model: Buchstaben stehen auf dem Tisch", letters.every((letter) => near(letter.box.min.y, CONFIG.TABLE_Y, 1e-3)));
check("model: genug Vertices zum Verformen", letters.every((letter) => letter.temperatures.length > 200));
const halfBurn = burnHeight(letters[0], CONFIG.BURN_SECONDS / 2);
updateLetter(letters[0], halfBurn);
const deformed = letters[0].mesh.geometry.getAttribute("position").array;
let highest = -Infinity;
let lowest = Infinity;
for (let i = 1; i < deformed.length; i += 3) {
  highest = Math.max(highest, deformed[i]);
  lowest = Math.min(lowest, deformed[i]);
}
check("heat: halb abgebrannt ist niedriger", highest < letters[0].top - 0.01);
check("heat: nichts sinkt unter den Tisch", lowest >= CONFIG.TABLE_Y - 1e-6);
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Expected: Titel nicht `PASS`.

- [ ] **Step 3: `model.js` implementieren**

```js
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import * as CONFIG from "./config.js";
import { buildGrid, cellIndex, floorOf, tallestColumnX } from "./grid.js";

export async function loadLetters(material) {
  let geometries;
  try {
    geometries = await loadSourceGeometries(CONFIG.MODEL_SOURCE);
  } catch (error) {
    console.warn("Modell nicht geladen, nutze Fallback-Zylinder:", error);
    geometries = fallbackGeometries();
  }
  return arrangeInRow(geometries).map(densify).map((geometry) => createLetter(geometry, material));
}

async function loadSourceGeometries(source) {
  // MODEL: neue Modellquelle hier ergänzen
  if (source === "text") return textGeometries();
  if (source === "gltf") return gltfGeometries();
  return fallbackGeometries();
}

async function textGeometries() {
  const font = await new FontLoader().loadAsync(CONFIG.FONT_URL);
  return [...CONFIG.WORD].map((character) => new TextGeometry(character, {
    font,
    size: CONFIG.LETTER_SIZE,
    height: CONFIG.LETTER_DEPTH,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: CONFIG.BEVEL,
    bevelSize: CONFIG.BEVEL,
    bevelSegments: 2,
  }));
}

async function gltfGeometries() {
  const gltf = await new GLTFLoader().loadAsync(CONFIG.GLTF_URL);
  gltf.scene.updateMatrixWorld(true);
  const geometries = [];
  gltf.scene.traverse((child) => {
    if (child.isMesh) geometries.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
  });
  if (geometries.length === 0) throw new Error("glTF enthält keine Meshes");
  return geometries.sort((a, b) => boundingBox(a).min.x - boundingBox(b).min.x);
}

function fallbackGeometries() {
  return [...CONFIG.WORD].map(() => new THREE.CylinderGeometry(0.3, 0.3, CONFIG.LETTER_SIZE, 24, 1));
}

function boundingBox(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox;
}

function arrangeInRow(geometries) {
  let cursor = 0;
  for (const geometry of geometries) {
    const box = boundingBox(geometry).clone();
    const scale = CONFIG.LETTER_SIZE / (box.max.y - box.min.y);
    geometry.translate(-box.min.x, -box.min.y, -(box.min.z + box.max.z) / 2);
    geometry.scale(scale, scale, scale);
    geometry.translate(cursor, CONFIG.TABLE_Y, 0);
    cursor += (box.max.x - box.min.x) * scale + CONFIG.LETTER_GAP;
  }
  const shift = -(cursor - CONFIG.LETTER_GAP) / 2;
  geometries.forEach((geometry) => geometry.translate(shift, 0, 0));
  return geometries;
}

function densify(geometry) {
  const positionsOnly = new THREE.BufferGeometry();
  positionsOnly.setAttribute("position", geometry.getAttribute("position"));
  positionsOnly.setIndex(geometry.getIndex());
  const dense = new TessellateModifier(CONFIG.TESSELLATE_EDGE, CONFIG.TESSELLATE_ITERATIONS).modify(positionsOnly);
  const merged = mergeVertices(dense);
  merged.computeVertexNormals();
  return merged;
}

function createLetter(geometry, material) {
  const rest = geometry.getAttribute("position").array.slice();
  const vertexCount = rest.length / 3;
  geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(rest.length), 3));
  const grid = buildGrid(rest);
  const floors = new Float32Array(vertexCount);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    floors[vertex] = floorOf(grid, cellIndex(grid, rest[vertex * 3], rest[vertex * 3 + 1]));
  }
  const box = boundingBox(geometry).clone();
  const wick = new THREE.Vector3(tallestColumnX(grid), box.max.y, (box.min.z + box.max.z) / 2);
  const reach = Math.max(box.max.x - wick.x, wick.x - box.min.x, box.max.z - wick.z);
  return {
    mesh: new THREE.Mesh(geometry, material),
    rest,
    floors,
    grid,
    wick,
    box,
    temperatures: new Float32Array(vertexCount),
    top: box.max.y,
    bottom: CONFIG.TABLE_Y - CONFIG.CRATER * reach * reach,
    burning: true,
  };
}
```

- [ ] **Step 4: Tests laufen lassen**

Expected: `<title>PASS</title>`, vier `model:`- und zwei neue `heat:`-Zeilen PASS. `info:`-Zeile notieren: Vertices pro Buchstabe sollten grob 1 000–15 000 sein. Bei > 20 000 `TESSELLATE_EDGE` auf `0.07` erhöhen.

---

### Task 7: Bruch (`breakage.js`)

**Files:**
- Create: `font/candle-szene/breakage.js`
- Modify: `font/candle-szene/verify.js`

- [ ] **Step 1: Failing Test schreiben**

Import:

```js
import { createBreakage, takeBrokenPieces } from "./breakage.js";
```

Tests (nach dem Model-Test, nutzt `letters`):

```js
const piecesPerLetter = letters.map((letter) => {
  const breakage = createBreakage(letter);
  let pieces = 0;
  for (let second = 0; second <= CONFIG.BURN_SECONDS; second += 1) {
    const burn = burnHeight(letter, second);
    updateLetter(letter, burn);
    pieces += takeBrokenPieces(letter, breakage, burn).length;
  }
  return pieces;
});
lines.push(`info: Brocken pro Buchstabe ${piecesPerLetter.join(", ")}`);
check("breakage: I bleibt ganz", piecesPerLetter[CONFIG.WORD.indexOf("I")] === 0);
check("breakage: E verliert Stücke", piecesPerLetter[CONFIG.WORD.indexOf("E")] > 0);
check("breakage: T verliert Stücke", piecesPerLetter[CONFIG.WORD.indexOf("T")] > 0);
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Expected: Titel nicht `PASS`.

- [ ] **Step 3: `breakage.js` implementieren**

```js
import * as THREE from "three";
import { CRATER, HEAT_WEAKENING, BREAK_THICKNESS, TABLE_Y } from "./config.js";
import { cellIndex, cellCenter, floorOf } from "./grid.js";
import { temperatureAt, wickHeight } from "./heat.js";

export function createBreakage(letter) {
  const { grid, rest } = letter;
  const index = letter.mesh.geometry.getIndex().array;
  const hangingRuns = new Map();
  for (let triangle = 0; triangle < index.length / 3; triangle++) {
    const a = index[triangle * 3] * 3;
    const b = index[triangle * 3 + 1] * 3;
    const c = index[triangle * 3 + 2] * 3;
    const x = (rest[a] + rest[b] + rest[c]) / 3;
    const y = (rest[a + 1] + rest[b + 1] + rest[c + 1]) / 3;
    const runStart = grid.runStart[cellIndex(grid, x, y)];
    if (floorOf(grid, runStart) <= TABLE_Y + 1e-4) continue;
    if (!hangingRuns.has(runStart)) hangingRuns.set(runStart, []);
    hangingRuns.get(runStart).push(triangle);
  }
  return { hangingRuns };
}

export function takeBrokenPieces(letter, breakage, burn) {
  const pieces = [];
  for (const [runStart, triangles] of breakage.hangingRuns) {
    const floor = floorOf(letter.grid, runStart);
    const dx = cellCenter(letter.grid, runStart).x - letter.wick.x;
    const remaining = burn + CRATER * dx * dx - floor;
    const temperature = temperatureAt(Math.hypot(dx, floor - wickHeight(burn)));
    if (remaining * (1 - HEAT_WEAKENING * temperature) < BREAK_THICKNESS) {
      pieces.push(cutOut(letter, triangles));
      breakage.hangingRuns.delete(runStart);
    }
  }
  return pieces;
}

function cutOut(letter, triangles) {
  const geometry = letter.mesh.geometry;
  const index = geometry.getIndex();
  const positions = geometry.getAttribute("position").array;
  const colors = geometry.getAttribute("color").array;
  const piecePositions = new Float32Array(triangles.length * 9);
  const pieceColors = new Float32Array(triangles.length * 9);
  triangles.forEach((triangle, k) => {
    for (let corner = 0; corner < 3; corner++) {
      const vertex = index.array[triangle * 3 + corner] * 3;
      piecePositions.set(positions.subarray(vertex, vertex + 3), k * 9 + corner * 3);
      pieceColors.set(colors.subarray(vertex, vertex + 3), k * 9 + corner * 3);
    }
    index.array[triangle * 3 + 1] = index.array[triangle * 3];
    index.array[triangle * 3 + 2] = index.array[triangle * 3];
  });
  index.needsUpdate = true;
  const piece = new THREE.BufferGeometry();
  piece.setAttribute("position", new THREE.BufferAttribute(piecePositions, 3));
  piece.setAttribute("color", new THREE.BufferAttribute(pieceColors, 3));
  const center = boundingCenter(piece);
  piece.translate(-center.x, -center.y, -center.z);
  piece.computeVertexNormals();
  return { geometry: piece, center };
}

function boundingCenter(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox.getCenter(new THREE.Vector3());
}
```

- [ ] **Step 4: Tests laufen lassen**

Expected: `<title>PASS</title>`, drei `breakage:`-Zeilen PASS. Falls „I bleibt ganz" fehlschlägt: Zelllücken im Raster → `CELL_SIZE` auf `0.12` erhöhen oder `TESSELLATE_EDGE` senken, Test erneut.

---

### Task 8: Tropfen (`drops.js`)

**Files:**
- Create: `font/candle-szene/drops.js`
- Modify: `font/candle-szene/verify.js`

- [ ] **Step 1: Failing Test schreiben**

Import:

```js
import { mergeDrops } from "./drops.js";
```

Tests:

```js
const dropA = { radius: 0.1, position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3(1, 0, 0), temperature: 1, sliding: true, floor: 0, body: null };
const dropB = { radius: 0.2, position: new THREE.Vector3(1, 0, 0), velocity: new THREE.Vector3(0, 0, 0), temperature: 0, sliding: false, floor: 0.5, body: null };
const mergedDrop = mergeDrops(dropA, dropB);
check("drops: Volumen bleibt beim Mergen", near(mergedDrop.radius ** 3, 0.1 ** 3 + 0.2 ** 3));
check("drops: Position massegewichtet", near(mergedDrop.position.x, 0.008 / 0.009));
check("drops: Impuls bleibt", near(mergedDrop.velocity.x, 0.001 / 0.009));
check("drops: größerer Tropfen bestimmt Zustand", mergedDrop.sliding === false && mergedDrop.floor === 0.5);
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Expected: Titel nicht `PASS`.

- [ ] **Step 3: `drops.js` implementieren**

```js
import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import * as CONFIG from "./config.js";
import { waxColor } from "./heat.js";

const ballColor = new THREE.Color();

export function mergeDrops(a, b) {
  const massA = a.radius ** 3;
  const massB = b.radius ** 3;
  const mass = massA + massB;
  const bigger = massA >= massB ? a : b;
  return {
    radius: Math.cbrt(mass),
    position: new THREE.Vector3().addScaledVector(a.position, massA).addScaledVector(b.position, massB).divideScalar(mass),
    velocity: new THREE.Vector3().addScaledVector(a.velocity, massA).addScaledVector(b.velocity, massB).divideScalar(mass),
    temperature: (a.temperature * massA + b.temperature * massB) / mass,
    sliding: bigger.sliding,
    floor: bigger.floor,
    body: null,
  };
}

export function createDropSystem(scene, physics, letters) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
  const pools = letters.map((letter) => createPool(scene, letter, material));
  return {
    update(dt, burnDt) {
      for (const pool of pools) {
        spawnDrop(pool, burnDt);
        moveDrops(pool, physics, dt);
        mergeTouching(pool, physics);
        for (const drop of pool.drops) drop.temperature = Math.max(0, drop.temperature - burnDt / CONFIG.COOL_SECONDS);
        render(pool, physics);
      }
    },
  };
}

function createPool(scene, letter, material) {
  const { box } = letter;
  const halfSize = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) / 2 + CONFIG.POOL_MARGIN;
  const field = new MarchingCubes(CONFIG.MC_RESOLUTION, material, false, true, 20000);
  field.position.set((box.min.x + box.max.x) / 2, CONFIG.TABLE_Y - CONFIG.POOL_MARGIN / 2 + halfSize, 0);
  field.scale.setScalar(halfSize);
  scene.add(field);
  return { letter, field, halfSize, drops: [], spawnTimer: 0 };
}

function spawnDrop(pool, burnDt) {
  pool.spawnTimer -= burnDt;
  if (!pool.letter.burning || pool.spawnTimer > 0 || pool.drops.length >= CONFIG.MAX_DROPS_PER_LETTER) return;
  pool.spawnTimer = CONFIG.DROP_INTERVAL * (0.5 + Math.random());
  const vertex = findMeltingVertex(pool.letter);
  if (vertex < 0) return;
  const geometry = pool.letter.mesh.geometry;
  const radius = THREE.MathUtils.randFloat(CONFIG.DROP_MIN_R, CONFIG.DROP_MAX_R);
  const normal = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("normal"), vertex);
  pool.drops.push({
    radius,
    position: new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("position"), vertex).addScaledVector(normal, radius * 0.5),
    velocity: new THREE.Vector3(),
    temperature: pool.letter.temperatures[vertex],
    sliding: true,
    floor: pool.letter.floors[vertex],
    body: null,
  });
}

function findMeltingVertex(letter) {
  const normals = letter.mesh.geometry.getAttribute("normal");
  for (let attempt = 0; attempt < 30; attempt++) {
    const vertex = Math.floor(Math.random() * letter.temperatures.length);
    const temperature = letter.temperatures[vertex];
    const facesCamera = Math.abs(normals.getZ(vertex)) > 0.7;
    if (facesCamera && temperature > CONFIG.DROP_MIN_TEMPERATURE && temperature < CONFIG.DROP_MAX_TEMPERATURE) return vertex;
  }
  return -1;
}

function moveDrops(pool, physics, dt) {
  for (const drop of pool.drops) {
    if (drop.sliding) {
      drop.position.y -= CONFIG.SLIDE_SPEED * dt;
      if (drop.position.y - drop.radius <= drop.floor) {
        drop.sliding = false;
        drop.body = physics.addDrop(drop.position, drop.radius, new THREE.Vector3(0, -CONFIG.SLIDE_SPEED, 0));
      }
    } else {
      drop.position.copy(physics.position(drop.body));
      drop.velocity.copy(physics.velocity(drop.body));
    }
  }
}

function mergeTouching(pool, physics) {
  const drops = pool.drops;
  for (let i = 0; i < drops.length; i++) {
    for (let j = i + 1; j < drops.length; j++) {
      const a = drops[i];
      const b = drops[j];
      if (a.position.distanceTo(b.position) >= a.radius + b.radius) continue;
      const merged = mergeDrops(a, b);
      if (a.body) physics.remove(a.body);
      if (b.body) physics.remove(b.body);
      if (!merged.sliding) merged.body = physics.addDrop(merged.position, merged.radius, merged.velocity);
      drops[i] = merged;
      drops.splice(j, 1);
      j = i;
    }
  }
}

function render(pool, physics) {
  const { field, halfSize } = pool;
  const boxSize = 2 * halfSize;
  field.reset();
  for (const drop of pool.drops) {
    const resting = drop.body !== null && physics.isResting(drop.body);
    const radius = resting ? drop.radius * CONFIG.PUDDLE_SPREAD : drop.radius;
    const y = resting ? CONFIG.TABLE_Y - radius * CONFIG.PUDDLE_SINK : drop.position.y;
    const normalizedRadius = radius / boxSize;
    field.addBall(
      (drop.position.x - field.position.x) / boxSize + 0.5,
      (y - field.position.y) / boxSize + 0.5,
      (drop.position.z - field.position.z) / boxSize + 0.5,
      normalizedRadius * normalizedRadius * (field.isolation + CONFIG.MC_SUBTRACT),
      CONFIG.MC_SUBTRACT,
      waxColor(drop.temperature, ballColor),
    );
  }
  field.update();
}
```

- [ ] **Step 4: Tests laufen lassen**

Expected: `<title>PASS</title>`, vier `drops:`-Zeilen PASS.

---

### Task 9: Flamme und Tisch

**Files:**
- Create: `font/candle-szene/flame.js`
- Create: `font/candle-szene/table.js`

Keine Unit-Tests (reine Darstellung), Prüfung in Task 10 per Screenshot.

- [ ] **Step 1: `flame.js` implementieren**

```js
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
```

- [ ] **Step 2: `table.js` implementieren**

```js
import * as THREE from "three";
import { TABLE_Y } from "./config.js";

// TABLE: Partner ersetzt diese Funktion durch den echten Tisch, Oberfläche muss auf TABLE_Y liegen
export function createTable(scene) {
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = TABLE_Y;
  scene.add(table);
  return table;
}
```

---

### Task 10: Szene und Loop (`main.js`)

**Files:**
- Create: `font/candle-szene/main.js`

- [ ] **Step 1: `main.js` implementieren**

```js
import * as THREE from "three";
import * as CONFIG from "./config.js";
import { loadLetters } from "./model.js";
import { burnHeight, updateLetter, wickHeight } from "./heat.js";
import { createBreakage, takeBrokenPieces } from "./breakage.js";
import { createDropSystem } from "./drops.js";
import { createFlame } from "./flame.js";
import { createTable } from "./table.js";

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
  const chunk = new THREE.Mesh(piece.geometry, waxMaterial);
  chunk.position.copy(piece.center);
  scene.add(chunk);
  physics.addChunk(chunk);
  chunkCount++;
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
```

- [ ] **Step 2: Tests erneut laufen lassen (Regression)**

Expected: `<title>PASS</title>`.

- [ ] **Step 3: Headless-Screenshot nach ~15 s Szenenzeit**

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=15000 --screenshot=/private/tmp/claude-502/-Users-pni-Uni-gg-generative-gestaltung/91e36c78-80c8-4f6e-a199-b56ec94583ab/scratchpad/shot.png http://localhost:8765/index.html
```

Screenshot mit Read ansehen. Expected: vier Buchstaben ZEIT auf dunklem Tisch, Flammen auf den Buchstaben, warm gefärbte Bereiche um die Dochte, HUD oben links. Bei schwarzem Bild: Browser-Konsole prüfen mit
`--enable-logging=stderr --v=0` am selben Befehl und `grep -i "error\|uncaught"`.

- [ ] **Step 4: Screenshot nach Abbrennen**

Gleicher Befehl, `--virtual-time-budget=130000`. Expected: Buchstaben weitgehend weg, Wachspfützen und Brocken auf dem Tisch, Flammen aus.

---

### Task 11: Architektur-README und manuelle Prüfung

**Files:**
- Create: `font/candle-szene/README.md`

- [ ] **Step 1: README schreiben**

```markdown
# ZEIT – Kerze aus Text

Starten: im Ordner `python3 -m http.server 8765`, dann http://localhost:8765 öffnen.
Tests: http://localhost:8765/verify.html (Titel zeigt PASS / FAIL).

Tasten: `F` 4× schneller, `R` neu starten.

## Module

| Datei | Aufgabe |
|---|---|
| `config.js` | alle Zahlen und Umschalter (`// CONFIG:`, `// PHYSICS:`, `// TABLE:`) |
| `model.js` | lädt Text, glTF oder Fallback-Zylinder, verdichtet das Mesh, setzt Docht (`// MODEL:`) |
| `grid.js` | rastert jeden Buchstaben in Wachssäulen (XY-Zellen), weiß wo jede Säule beginnt |
| `heat.js` | Brennhöhe, Temperatur pro Vertex (nur Abstand zum eigenen Docht), Verformung, Farbe |
| `breakage.js` | hängende Säulen, die dünn und heiß werden, brechen als Brocken ab |
| `drops.js` | Tropfen entstehen am heißen Rand, gleiten, fallen, verschmelzen (Metaballs) |
| `physics/own.js` | eigene Physik: Schwerkraft, Euler-Schritt, Tischebene |
| `physics/cannon.js` | gleiche Schnittstelle mit cannon-es |
| `flame.js` | Flamme aus zwei Sprites + flackerndes Punktlicht |
| `table.js` | Platzhalter-Tisch für den Partner |
| `main.js` | Szene, Kamera, Loop, HUD |

## Ablauf pro Frame

Zeit → Brennhöhe pro Buchstabe → `updateLetter` verformt und färbt → `takeBrokenPieces` löst Brocken → Physik → Tropfen spawnen, gleiten, mergen, rendern → Bild.

## Kräfte und Regeln

- **Abbrennen:** jeder Vertex wird auf `Brennhöhe + CRATER · r²` gedeckelt (r = waagrechter Abstand zum Docht). Ergebnis: Mulde um den Docht, Ränder bleiben stehen.
- **Hitze:** `T = 1 − Abstand / HEAT_RADIUS`, nur zum eigenen Docht. Heißes Wachs sackt um `SAG · T²` ab und wird orange.
- **Bruch:** Säulen, die nicht auf dem Tisch stehen (hängend, z. B. Querbalken von E und T), brechen, wenn `Restdicke · (1 − HEAT_WEAKENING · T) < BREAK_THICKNESS`.
- **Tropfen-Merge:** berühren sich zwei Tropfen, entsteht einer mit gleichem Volumen (`r = ∛(r1³ + r2³)`) am Massenschwerpunkt. Metaballs verschmelzen optisch schon vorher.
- **Tisch:** Physik kennt nur `TABLE_Y`. Liegende Tropfen werden als flache, eingesunkene Kugeln gezeichnet → Pfütze.

## Umschalten

- Modell: `MODEL_SOURCE` in `config.js` (`"text"`, `"gltf"`, `"fallback"`). Bei Ladefehler automatisch Fallback.
- Physik: `PHYSICS_BACKEND` (`"own"`, `"cannon"`).
- Tisch: `createTable` in `table.js` ersetzen, Oberkante auf `TABLE_Y`.
```

- [ ] **Step 2: Manuelle Prüfung durch User (FPS kann headless nicht gemessen werden)**

User öffnet http://localhost:8765 in Chrome und prüft:
1. HUD zeigt ≥ 30 FPS über das ganze Abbrennen (mit `F` beschleunigen).
2. `PHYSICS_BACKEND = "cannon"` → Seite neu laden → läuft, Tropfen/Brocken landen auf Tisch.
3. `MODEL_SOURCE = "gltf"` ohne Datei → Konsole zeigt Warnung, Zylinder erscheinen.

Bei < 30 FPS zuerst `MC_RESOLUTION` auf 40 senken, dann `TESSELLATE_EDGE` auf 0.07 erhöhen.
