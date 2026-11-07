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
