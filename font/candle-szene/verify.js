import * as THREE from "three";
import * as CONFIG from "./config.js";
import { buildGrid, cellIndex, floorOf, tallestColumnX } from "./grid.js";
import { temperatureAt, burnHeight, wickHeight, waxColor, updateLetter } from "./heat.js";

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

const gridPoints = [];
for (let y = 0; y <= 1.0001; y += 0.02) gridPoints.push(0.05, y, 0);
for (let y = 0.62; y <= 1.0001; y += 0.02) gridPoints.push(0.55, y, 0);
const testGrid = buildGrid(new Float32Array(gridPoints));
check("grid: stehende Säule beginnt auf 0", near(floorOf(testGrid, cellIndex(testGrid, 0.05, 0.9)), 0));
check("grid: hängende Säule beginnt über 0.5", floorOf(testGrid, cellIndex(testGrid, 0.55, 0.9)) > 0.5);
const wickPoints = [];
for (let y = 0; y <= 0.3001; y += 0.02) wickPoints.push(0.05, y, 0, 0.95, y, 0);
for (let y = 0; y <= 1.0001; y += 0.02) wickPoints.push(0.66, y, 0);
check("grid: Docht über höchster Säule", Math.abs(tallestColumnX(buildGrid(new Float32Array(wickPoints))) - 0.7) < CONFIG.CELL_SIZE / 2);
const tiePoints = [];
for (let y = 0; y <= 0.3001; y += 0.02) tiePoints.push(0.05, y, 0, 0.95, y, 0);
for (let y = 0; y <= 1.0001; y += 0.02) tiePoints.push(0.26, y, 0, 0.46, y, 0);
check("grid: bei Gleichstand Säule näher zur Mitte", Math.abs(tallestColumnX(buildGrid(new Float32Array(tiePoints))) - 0.5) < CONFIG.CELL_SIZE / 2);

check("heat: am Docht heiß", temperatureAt(0) === 1);
check("heat: am Rand kalt", temperatureAt(CONFIG.HEAT_RADIUS) === 0);
check("heat: fällt mit Abstand", temperatureAt(0.1) > temperatureAt(0.2));
const fakeLetter = { top: 1, bottom: -0.5 };
check("heat: Brennhöhe Start = Oberkante", near(burnHeight(fakeLetter, 0), 1));
check("heat: Brennhöhe Ende = Unterkante", near(burnHeight(fakeLetter, CONFIG.BURN_SECONDS), -0.5));
check("heat: Docht nie unter Tisch", wickHeight(-0.5) === CONFIG.TABLE_Y);
check("heat: heißes Wachs röter als kaltes", waxColor(1, new THREE.Color()).b < waxColor(0, new THREE.Color()).b);

for (const backend of ["own"]) {
  const { createPhysics } = await import(`./physics/${backend}.js`);
  const physics = createPhysics({ gravity: CONFIG.GRAVITY, tableY: CONFIG.TABLE_Y });
  const body = physics.addDrop(new THREE.Vector3(0, CONFIG.TABLE_Y + 1, 0), 0.05, new THREE.Vector3());
  for (let i = 0; i < 180; i++) physics.step(1 / 60);
  check(`physics ${backend}: Tropfen fällt nicht durch Tisch`, physics.position(body).y >= CONFIG.TABLE_Y + 0.04);
  check(`physics ${backend}: Tropfen ist gelandet`, physics.position(body).y < CONFIG.TABLE_Y + 0.1);
  check(`physics ${backend}: Tropfen liegt still`, physics.isResting(body));
}

document.getElementById("out").textContent = lines.join("\n");
document.title = failures ? `FAIL ${failures}` : "PASS";
