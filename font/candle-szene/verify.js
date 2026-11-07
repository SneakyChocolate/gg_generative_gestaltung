import * as THREE from "three";
import * as CONFIG from "./config.js";
import { buildGrid, cellIndex, floorOf, tallestColumnX } from "./grid.js";

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

document.getElementById("out").textContent = lines.join("\n");
document.title = failures ? `FAIL ${failures}` : "PASS";
