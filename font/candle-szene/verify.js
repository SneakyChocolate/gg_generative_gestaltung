import * as THREE from "three";
import * as CONFIG from "./config.js";
import { buildGrid, cellIndex, floorOf, tallestColumnX } from "./grid.js";
import { loadLetters } from "./model.js";
import { temperatureAt, burnHeight, wickHeight, waxColor, updateLetter } from "./heat.js";
import { createBreakage, takeBrokenPieces } from "./breakage.js";
import { mergeDrops } from "./drops.js";
import { stepFall } from "./physics.js";

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

const fallingBody = { position: new THREE.Vector3(0.2, 1, -0.1), velocity: new THREE.Vector3(), radius: 0, resting: false };
for (let i = 0; i < 180; i++) stepFall(fallingBody, 1 / 60, 0.3);
check("physics: Körper landet genau auf groundY", near(fallingBody.position.y, 0.3));
check("physics: gelandeter Körper ruht", fallingBody.resting && fallingBody.velocity.length() === 0);
check("physics: keine seitliche Bewegung", fallingBody.position.x === 0.2 && fallingBody.position.z === -0.1);
const roundBody = { position: new THREE.Vector3(0, 1, 0), velocity: new THREE.Vector3(), radius: 0.05, resting: false };
for (let i = 0; i < 180; i++) stepFall(roundBody, 1 / 60, CONFIG.TABLE_Y);
check("physics: Kugel liegt mit Radius über dem Boden", near(roundBody.position.y, CONFIG.TABLE_Y + 0.05));

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

const piecesPerLetter = letters.map((letter) => {
  const breakage = createBreakage(letter);
  let pieces = 0;
  for (let second = 0; second <= CONFIG.BURN_SECONDS; second += 1) {
    const burn = burnHeight(letter, second);
    updateLetter(letter, burn);
    pieces += takeBrokenPieces(letter, breakage, burn).length;
  }
  const index = letter.mesh.geometry.getIndex().array;
  const positions = letter.mesh.geometry.getAttribute("position").array;
  let highestStanding = -Infinity;
  for (let corner = 0; corner < index.length; corner += 3) {
    if (index[corner] === index[corner + 1]) continue;
    for (let k = 0; k < 3; k++) highestStanding = Math.max(highestStanding, positions[index[corner + k] * 3 + 1]);
  }
  check(`heat: ${CONFIG.WORD[letters.indexOf(letter)]} ist am Ende ganz abgebrannt`, highestStanding < CONFIG.TABLE_Y + 0.01);
  return pieces;
});
lines.push(`info: Brocken pro Buchstabe ${piecesPerLetter.join(", ")}`);
check("breakage: I bleibt ganz", piecesPerLetter[CONFIG.WORD.indexOf("I")] === 0);
check("breakage: E verliert Stücke", piecesPerLetter[CONFIG.WORD.indexOf("E")] > 0);
check("breakage: T verliert Stücke", piecesPerLetter[CONFIG.WORD.indexOf("T")] > 0);

const dropA = { radius: 0.1, position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3(1, 0, 0), temperature: 1, sliding: true, floor: 0, resting: false };
const dropB = { radius: 0.2, position: new THREE.Vector3(1, 0, 0), velocity: new THREE.Vector3(0, 0, 0), temperature: 0, sliding: false, floor: 0.5, resting: false };
const mergedDrop = mergeDrops(dropA, dropB);
check("drops: Volumen bleibt beim Mergen", near(mergedDrop.radius ** 3, 0.1 ** 3 + 0.2 ** 3));
check("drops: Position massegewichtet", near(mergedDrop.position.x, 0.008 / 0.009));
check("drops: Impuls bleibt", near(mergedDrop.velocity.x, 0.001 / 0.009));
check("drops: größerer Tropfen bestimmt Zustand", mergedDrop.sliding === false && mergedDrop.floor === 0.5);

document.getElementById("out").textContent = lines.join("\n");
document.title = failures ? `FAIL ${failures}` : "PASS";
