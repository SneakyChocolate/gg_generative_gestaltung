import * as CONFIG from "./config.js";

const MARGIN = 0.05;

export function createSurface(letter) {
  const minX = letter.box.min.x - MARGIN;
  const minZ = letter.box.min.z - MARGIN;
  const cols = Math.ceil((letter.box.max.x + MARGIN - minX) / CONFIG.SURFACE_CELL);
  const rows = Math.ceil((letter.box.max.z + MARGIN - minZ) / CONFIG.SURFACE_CELL);
  return { minX, minZ, cols, rows, heights: new Float32Array(cols * rows).fill(-Infinity) };
}

export function updateSurface(surface, letter) {
  const { heights } = surface;
  const positions = letter.mesh.geometry.getAttribute("position").array;
  const index = letter.mesh.geometry.getIndex().array;
  heights.fill(-Infinity);
  for (let corner = 0; corner < index.length; corner += 3) {
    const a = index[corner];
    const b = index[corner + 1];
    const c = index[corner + 2];
    if (a === b || b === c || a === c) continue;
    if (letter.falling[a] === 1 || letter.falling[b] === 1 || letter.falling[c] === 1) continue;
    raise(surface, positions, a);
    raise(surface, positions, b);
    raise(surface, positions, c);
  }
}

export function heightAt(surface, x, z) {
  const cell = cellOf(surface, x, z);
  return cell < 0 ? -Infinity : surface.heights[cell];
}

function raise(surface, positions, vertex) {
  const cell = cellOf(surface, positions[vertex * 3], positions[vertex * 3 + 2]);
  if (cell >= 0 && positions[vertex * 3 + 1] > surface.heights[cell]) surface.heights[cell] = positions[vertex * 3 + 1];
}

function cellOf(surface, x, z) {
  const col = Math.floor((x - surface.minX) / CONFIG.SURFACE_CELL);
  const row = Math.floor((z - surface.minZ) / CONFIG.SURFACE_CELL);
  if (col < 0 || col >= surface.cols || row < 0 || row >= surface.rows) return -1;
  return row * surface.cols + col;
}
