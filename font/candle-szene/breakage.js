import * as THREE from "three";
import { CRATER, HEAT_WEAKENING, BREAK_THICKNESS, WEIGHT_LEVERAGE, TABLE_Y } from "./config.js";
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
    if (!hangingRuns.has(runStart)) hangingRuns.set(runStart, { triangles: [], weight: 0 });
    const run = hangingRuns.get(runStart);
    run.triangles.push(triangle);
    run.weight = Math.max(run.weight, rest[a + 1] - floorOf(grid, runStart), rest[b + 1] - floorOf(grid, runStart), rest[c + 1] - floorOf(grid, runStart));
  }
  return { hangingRuns };
}

export function takeBrokenPieces(letter, breakage, burn) {
  const pieces = [];
  for (const [runStart, { triangles, weight }] of breakage.hangingRuns) {
    const floor = floorOf(letter.grid, runStart);
    const dx = cellCenter(letter.grid, runStart).x - letter.wick.x;
    const remaining = burn + CRATER * dx * dx - floor;
    const temperature = temperatureAt(Math.hypot(dx, floor - wickHeight(burn)));
    if (remaining * (1 - HEAT_WEAKENING * temperature) < BREAK_THICKNESS + WEIGHT_LEVERAGE * weight) {
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
