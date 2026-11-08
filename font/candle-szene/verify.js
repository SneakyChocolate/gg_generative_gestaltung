import * as THREE from "three";
import * as CONFIG from "./config.js";
import { buildGrid, cellIndex, floorOf, tallestColumnX } from "./grid.js";
import { loadLetters } from "./model.js";
import { temperatureAt, burnHeight, wickHeight, waxColor, updateLetter } from "./heat.js";
import { createBreakage, checkBreaks, findBreakingComponents, supportedCells } from "./breakage.js";
import { breakOff, updatePieces, releaseUnsupported } from "./pieces.js";
import { mergeDrops } from "./drops.js";
import { stepFall } from "./physics.js";
import { createSurface, updateSurface, heightAt } from "./surface.js";

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
lines.push(`info: Vertices pro Buchstabe ${letters.map((letter) => letter.vertexCount).join(", ")}`);
check("model: ein Mesh pro Buchstabe", letters.length === CONFIG.WORD.length);
check("model: Docht liegt über dem Buchstaben", letters.every((letter) => letter.wick.x >= letter.box.min.x && letter.wick.x <= letter.box.max.x));
check("model: Buchstaben stehen auf dem Tisch", letters.every((letter) => near(letter.box.min.y, CONFIG.TABLE_Y, 1e-3)));
check("model: genug Vertices zum Verformen", letters.every((letter) => letter.vertexCount > 200));
const halfBurn = burnHeight(letters[0], CONFIG.BURN_SECONDS / 2);
updateLetter(letters[0], halfBurn, 0);
const deformed = letters[0].mesh.geometry.getAttribute("position").array;
let highest = -Infinity;
let lowest = Infinity;
for (let i = 1; i < letters[0].vertexCount * 3; i += 3) {
  highest = Math.max(highest, deformed[i]);
  lowest = Math.min(lowest, deformed[i]);
}
check("heat: halb abgebrannt ist niedriger", highest < letters[0].top - 0.01);
check("heat: nichts sinkt unter den Tisch", lowest >= CONFIG.TABLE_Y - 1e-6);

const flameLetter = letters[0];
const flameBurn = flameLetter.top;
const flameCentre = new THREE.Vector3(flameLetter.wick.x, wickHeight(flameBurn) + CONFIG.FLAME_HEAT_OFFSET, flameLetter.wick.z);
const fallenVertex = 0;
const farVertex = 1;
flameLetter.base.set([flameCentre.x, flameCentre.y - 0.05, flameCentre.z], fallenVertex * 3);
flameLetter.base.set([flameCentre.x + CONFIG.HEAT_RADIUS + 0.01, flameCentre.y, flameCentre.z], farVertex * 3);
updateLetter(flameLetter, flameBurn, 0);
check("heat: abgefallener Vertex nahe Flamme ist heiß", flameLetter.temperatures[fallenVertex] > 0.7);
check("heat: Vertex mit base außerhalb HEAT_RADIUS ist kalt", flameLetter.temperatures[farVertex] === 0);
flameLetter.base.set(flameLetter.rest.subarray(0, 6));

const bulgeLetter = letters[1];
updateLetter(bulgeLetter, bulgeLetter.top, 0);
let bulgeVertex = -1;
for (let vertex = 0; vertex < bulgeLetter.vertexCount; vertex++) {
  const cold = bulgeLetter.temperatures[vertex] === 0;
  if (cold && bulgeLetter.restNormals[vertex * 3 + 2] > 0.9) bulgeVertex = vertex;
}
bulgeLetter.deposit[bulgeVertex] = 0.02;
updateLetter(bulgeLetter, bulgeLetter.top, 0);
const bulgeZ = bulgeLetter.mesh.geometry.getAttribute("position").array[bulgeVertex * 3 + 2];
check("heat: deposit wölbt nach außen", bulgeVertex >= 0 && near(bulgeZ, bulgeLetter.base[bulgeVertex * 3 + 2] + 0.02 * bulgeLetter.restNormals[bulgeVertex * 3 + 2], 1e-6) && bulgeZ - bulgeLetter.base[bulgeVertex * 3 + 2] > 0.018);

const meltLetter = letters[2];
updateLetter(meltLetter, meltLetter.top, 0);
let meltVertex = -1;
for (let vertex = 0; vertex < meltLetter.vertexCount; vertex++) {
  if (meltLetter.temperatures[vertex] > CONFIG.DEPOSIT_MELT_T) meltVertex = vertex;
}
meltLetter.deposit[meltVertex] = 0.02;
updateLetter(meltLetter, meltLetter.top, 1);
check("heat: heißes Wachs schmilzt deposit", meltVertex >= 0 && meltLetter.deposit[meltVertex] < 0.02);

check("model: Reserveplatz", letters.every((letter) => {
  const index = letter.mesh.geometry.getIndex().array;
  let maxIndex = 0;
  for (const vertex of index) maxIndex = Math.max(maxIndex, vertex);
  return letter.capacity >= 1.5 * letter.vertexCount
    && letter.mesh.geometry.getAttribute("position").count === letter.capacity
    && maxIndex < letter.vertexCount;
}));

function syntheticGrid(cols, rows, aliveCells) {
  const alive = new Uint8Array(cols * rows);
  for (const [col, row] of aliveCells) alive[row * cols + col] = 1;
  return { grid: { cols, rows }, alive };
}

function cellsInRect(fromCol, toCol, fromRow, toRow) {
  const cells = [];
  for (let col = fromCol; col <= toCol; col++) {
    for (let row = fromRow; row <= toRow; row++) cells.push([col, row]);
  }
  return cells;
}

const cold = () => 0;
const hot = () => 1;
const burnedT = syntheticGrid(7, 6, [...cellsInRect(2, 4, 0, 2), ...cellsInRect(0, 1, 4, 5), ...cellsInRect(5, 6, 4, 5)]);
const fallingArms = findBreakingComponents(burnedT.grid, burnedT.alive, cold);
check("breakage: T ohne Stammspitze → beide Arme fallen", fallingArms.length === 2 && fallingArms.every((cells) => cells.length === 4));
check("breakage: Stamm bleibt stehen", fallingArms.every((cells) => cells.every((cell) => cell % 7 < 2 || cell % 7 > 4)));
const shortArm = syntheticGrid(6, 4, [...cellsInRect(0, 0, 0, 3), ...cellsInRect(1, 4, 3, 3)]);
check("breakage: kalter kurzer Überhang hält", findBreakingComponents(shortArm.grid, shortArm.alive, cold).length === 0);
const hotArm = findBreakingComponents(shortArm.grid, shortArm.alive, hot);
check("breakage: heißer kurzer Überhang bricht als ein Teil", hotArm.length === 1 && hotArm[0].length === 4);
const pillar = syntheticGrid(3, 8, cellsInRect(0, 2, 0, 7));
check("breakage: Säule bricht nie", findBreakingComponents(pillar.grid, pillar.alive, hot).length === 0);

const breakAtStart = letters.map((letter) => checkBreaks(letter, createBreakage(letter), letter.top).length);
lines.push(`info: Brüche bei t=0 ${breakAtStart.join(", ")}`);
check("breakage: bei t=0 bricht nichts", breakAtStart.every((count) => count === 0));

const dropA = { radius: 0.1, position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3(1, 0, 0), temperature: 1, sliding: true, floor: 0, resting: false };
const dropB = { radius: 0.2, position: new THREE.Vector3(1, 0, 0), velocity: new THREE.Vector3(0, 0, 0), temperature: 0, sliding: false, floor: 0.5, resting: false };
const mergedDrop = mergeDrops(dropA, dropB);
check("drops: Volumen bleibt beim Mergen", near(mergedDrop.radius ** 3, 0.1 ** 3 + 0.2 ** 3));
check("drops: Position massegewichtet", near(mergedDrop.position.x, 0.008 / 0.009));
check("drops: Impuls bleibt", near(mergedDrop.velocity.x, 0.001 / 0.009));
check("drops: größerer Tropfen bestimmt Zustand", mergedDrop.sliding === false && mergedDrop.floor === 0.5);

const surfaceLetter = letters[CONFIG.WORD.indexOf("E")];
updateLetter(surfaceLetter, surfaceLetter.top, 0);
const surface = createSurface(surfaceLetter);
for (let vertex = 0; vertex < surfaceLetter.vertexCount; vertex++) {
  const rightOfStem = surfaceLetter.rest[vertex * 3] > surfaceLetter.box.min.x + 0.25;
  surfaceLetter.falling[vertex] = rightOfStem && surfaceLetter.rest[vertex * 3 + 1] > 0.35 ? 1 : 0;
}
updateSurface(surface, surfaceLetter);
const barHeight = heightAt(surface, surfaceLetter.box.max.x - 0.08, 0);
const stemHeight = heightAt(surface, surfaceLetter.box.min.x + 0.08, 0);
lines.push(`info: E Höhe über Balken ${barHeight.toFixed(3)}, über Stamm ${stemHeight.toFixed(3)}`);
check("surface: über dem unteren E-Balken ≈ Balkenoberkante", barHeight > 0.1 && barHeight < 0.3 && barHeight < stemHeight);
check("surface: neben dem Buchstaben leer", heightAt(surface, surfaceLetter.box.max.x + 0.5, 0) === -Infinity && heightAt(surface, surfaceLetter.box.min.x - 0.5, 0) === -Infinity);
surfaceLetter.falling.fill(1);
updateSurface(surface, surfaceLetter);
check("surface: fallende Vertices zählen nicht", surface.heights.every((height) => height === -Infinity));
surfaceLetter.falling.fill(0);

const STEP = 0.1;
const SETTLE_SECONDS = 10;

function countHovering(letter, breakage) {
  const aliveNow = breakage.alive.map((alive, cell) => (alive && !breakage.detached[cell] ? 1 : 0));
  const supported = supportedCells(letter.grid, aliveNow);
  return aliveNow.reduce((sum, alive, cell) => sum + (alive && !supported[cell] ? 1 : 0), 0);
}

function burnWithPieces(letter) {
  const breakage = createBreakage(letter);
  const surface = createSurface(letter);
  const pieces = [];
  const result = { pieces, overflows: 0, hovering: 0, landedHot: false };
  const lastStep = Math.round((CONFIG.BURN_SECONDS + SETTLE_SECONDS) / STEP);
  for (let step = 0; step <= lastStep; step++) {
    const seconds = step * STEP;
    const burn = burnHeight(letter, Math.min(seconds, CONFIG.BURN_SECONDS));
    updatePieces(letter, pieces, surface, STEP);
    updateLetter(letter, burn, STEP);
    if (seconds <= CONFIG.BURN_SECONDS) {
      let broke = false;
      for (const cells of checkBreaks(letter, breakage, burn)) {
        const broken = breakOff(letter, breakage, cells, burn);
        if (broken === null) result.overflows++;
        else pieces.push(...broken);
        if (broken && broken.length > 0) broke = true;
      }
      if (broke) releaseUnsupported(letter, pieces, surface);
      result.hovering += countHovering(letter, breakage);
    }
    updateSurface(surface, letter);
    for (const piece of pieces) {
      if (piece.landed && piece.vertices.some((vertex) => letter.temperatures[vertex] > 0)) result.landedHot = true;
    }
  }
  return result;
}

function sharesIndexAcrossPieces(letter, pieces) {
  const index = letter.mesh.geometry.getIndex().array;
  const triangleOwner = new Int32Array(index.length / 3).fill(-1);
  pieces.forEach((piece, number) => piece.triangles.forEach((triangle) => { triangleOwner[triangle] = number; }));
  const vertexOwner = new Int32Array(letter.capacity).fill(-2);
  for (let triangle = 0; triangle < triangleOwner.length; triangle++) {
    for (let corner = 0; corner < 3; corner++) {
      const vertex = index[triangle * 3 + corner];
      if (vertexOwner[vertex] === -2) vertexOwner[vertex] = triangleOwner[triangle];
      else if (vertexOwner[vertex] !== triangleOwner[triangle]) return true;
    }
  }
  return false;
}

function pieceExtent(values, offset) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = offset; i < values.length; i += 3) {
    min = Math.min(min, values[i]);
    max = Math.max(max, values[i]);
  }
  return { min, max, size: max - min };
}

function centroidShift(letter, piece, offset) {
  let before = 0;
  let after = 0;
  piece.vertices.forEach((vertex, k) => {
    before += piece.start[k * 3 + offset];
    after += letter.base[vertex * 3 + offset];
  });
  return Math.abs(after - before) / piece.vertices.length;
}

function highestStanding(letter, pieces) {
  const index = letter.mesh.geometry.getIndex().array;
  const positions = letter.mesh.geometry.getAttribute("position").array;
  const inPiece = new Uint8Array(index.length / 3);
  for (const piece of pieces) piece.triangles.forEach((triangle) => { inPiece[triangle] = 1; });
  let highest = -Infinity;
  for (let triangle = 0; triangle < inPiece.length; triangle++) {
    const a = index[triangle * 3];
    const b = index[triangle * 3 + 1];
    const c = index[triangle * 3 + 2];
    if (inPiece[triangle] || a === b || b === c || a === c) continue;
    highest = Math.max(highest, positions[a * 3 + 1], positions[b * 3 + 1], positions[c * 3 + 1]);
  }
  return highest;
}

const burnResults = letters.map(burnWithPieces);
const piecesPerLetter = burnResults.map((result) => result.pieces.length);
lines.push(`info: Teile pro Buchstabe ${piecesPerLetter.join(", ")}`);
lines.push(`info: Kapazitäts-Überläufe ${burnResults.map((result) => result.overflows).join(", ")}, Vertices danach ${letters.map((letter) => `${letter.vertexCount}/${letter.capacity}`).join(", ")}`);
check("pieces: I bleibt ganz", piecesPerLetter[CONFIG.WORD.indexOf("I")] === 0);
check("pieces: E verliert Teile", piecesPerLetter[CONFIG.WORD.indexOf("E")] > 0);
check("pieces: T verliert Teile", piecesPerLetter[CONFIG.WORD.indexOf("T")] > 0);
check("pieces: kein Kapazitäts-Überlauf", burnResults.every((result) => result.overflows === 0));
check("pieces: nie lebende Zellen ohne Stütze (keine Schwebeteile)", burnResults.every((result) => result.hovering === 0));
check("pieces: jedes Teil ist gelandet", burnResults.every((result) => result.pieces.every((piece) => piece.landed)));
check("pieces: Teil und Rest teilen keinen Index", letters.every((letter, k) => !sharesIndexAcrossPieces(letter, burnResults[k].pieces)));
check("pieces: kein Schub zur Seite, nur Kippen", letters.every((letter, k) => burnResults[k].pieces.every((piece) => {
  const width = pieceExtent(piece.start, 0).size;
  return centroidShift(letter, piece, 0) <= width * Math.sin(CONFIG.TIP_MAX_ANGLE) + 0.02 && centroidShift(letter, piece, 2) < 1e-6;
})));
check("pieces: gelandetes Teil nahe der Flamme wird heiß", burnResults.some((result) => result.landedHot));
letters.forEach((letter, k) => {
  check(`heat: ${CONFIG.WORD[k]} ist am Ende abgebrannt (ohne gefallene Teile)`, highestStanding(letter, burnResults[k].pieces) < CONFIG.TABLE_Y + 0.02);
});
const positionsAtEnd = letters.map((letter) => letter.mesh.geometry.getAttribute("position").array);
check("pieces: gefallene Teile ragen nicht über ihre Landehöhe + Teilhöhe", letters.every((letter, k) => burnResults[k].pieces.every((piece) => {
  const landingHeight = Math.min(...piece.vertices.map((vertex) => letter.base[vertex * 3 + 1]));
  const drawnTop = Math.max(...piece.vertices.map((vertex) => positionsAtEnd[k][vertex * 3 + 1]));
  return drawnTop <= landingHeight + pieceExtent(piece.start, 1).size + 0.01;
})));

document.getElementById("out").textContent = lines.join("\n");
document.title = failures ? `FAIL ${failures}` : "PASS";
