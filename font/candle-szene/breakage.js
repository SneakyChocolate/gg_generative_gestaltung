import { CRATER, CELL_SIZE, HEAT_WEAKENING, CANTILEVER_STRENGTH, FLAME_HEAT_OFFSET } from "./config.js";
import { cellIndex, cellCenter } from "./grid.js";
import { temperatureAt, wickHeight } from "./heat.js";

export function createBreakage(letter) {
  const { grid, rest } = letter;
  const index = letter.mesh.geometry.getIndex().array;
  const cellTriangles = Array.from({ length: grid.cols * grid.rows }, () => []);
  for (let triangle = 0; triangle < index.length / 3; triangle++) {
    const a = index[triangle * 3] * 3;
    const b = index[triangle * 3 + 1] * 3;
    const c = index[triangle * 3 + 2] * 3;
    const x = (rest[a] + rest[b] + rest[c]) / 3;
    const y = (rest[a + 1] + rest[b + 1] + rest[c + 1]) / 3;
    cellTriangles[cellIndex(grid, x, y)].push(triangle);
  }
  return { cellTriangles, alive: new Uint8Array(grid.cols * grid.rows), detached: new Uint8Array(grid.cols * grid.rows) };
}

export function checkBreaks(letter, breakage, burn) {
  const { grid, wick } = letter;
  for (let cell = 0; cell < breakage.alive.length; cell++) {
    breakage.alive[cell] = grid.filled[cell] && !breakage.detached[cell] && !isBurned(grid, cell, wick.x, burn) ? 1 : 0;
  }
  const flameY = wickHeight(burn) + FLAME_HEAT_OFFSET;
  const attachTemperature = (cell) => {
    const centre = cellCenter(grid, cell);
    return temperatureAt(Math.hypot(centre.x - wick.x, centre.y - flameY));
  };
  return findBreakingComponents(grid, breakage.alive, attachTemperature).map((cells) => withBurnedCellsAbove(grid, breakage, cells));
}

function isBurned(grid, cell, wickX, burn) {
  if (isBottomOfHangingRun(grid, cell)) return false;
  const dx = cellCenter(grid, cell).x - wickX;
  const cellBottom = grid.minY + Math.floor(cell / grid.cols) * CELL_SIZE;
  return burn + CRATER * dx * dx < cellBottom;
}

function isBottomOfHangingRun(grid, cell) {
  return grid.runStart[cell] === cell && cell >= grid.cols;
}

function withBurnedCellsAbove(grid, breakage, cells) {
  const runs = new Set(cells.map((cell) => grid.runStart[cell]));
  const burned = [];
  for (let cell = 0; cell < breakage.alive.length; cell++) {
    if (grid.filled[cell] && !breakage.alive[cell] && !breakage.detached[cell] && runs.has(grid.runStart[cell])) burned.push(cell);
  }
  return cells.concat(burned);
}

export function findBreakingComponents(grid, alive, attachTemperature) {
  const supported = supportedCells(grid, alive);
  const standing = standingCells(grid, alive);
  const unsupported = components(grid, (cell) => alive[cell] && !supported[cell]);
  const overhangs = components(grid, (cell) => alive[cell] && supported[cell] && !standing[cell]);
  return unsupported.concat(overhangs.filter((cells) => breaksUnderWeight(grid, cells, standing, attachTemperature)));
}

export function supportedCells(grid, alive) {
  const supported = new Uint8Array(alive.length);
  const stack = [];
  for (let col = 0; col < grid.cols; col++) {
    if (alive[col]) {
      supported[col] = 1;
      stack.push(col);
    }
  }
  while (stack.length) {
    forEachNeighbour(grid, stack.pop(), (neighbour) => {
      if (!alive[neighbour] || supported[neighbour]) return;
      supported[neighbour] = 1;
      stack.push(neighbour);
    });
  }
  return supported;
}

function standingCells(grid, alive) {
  const standing = new Uint8Array(alive.length);
  for (let cell = 0; cell < alive.length; cell++) {
    standing[cell] = alive[cell] && (cell < grid.cols || standing[cell - grid.cols]) ? 1 : 0;
  }
  return standing;
}

function components(grid, belongs) {
  const visited = new Uint8Array(grid.cols * grid.rows);
  const result = [];
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || !belongs(start)) continue;
    visited[start] = 1;
    const cells = [start];
    for (let next = 0; next < cells.length; next++) {
      forEachNeighbour(grid, cells[next], (neighbour) => {
        if (visited[neighbour] || !belongs(neighbour)) return;
        visited[neighbour] = 1;
        cells.push(neighbour);
      });
    }
    result.push(cells);
  }
  return result;
}

function forEachNeighbour(grid, cell, visit) {
  const col = cell % grid.cols;
  if (col > 0) visit(cell - 1);
  if (col < grid.cols - 1) visit(cell + 1);
  if (cell >= grid.cols) visit(cell - grid.cols);
  if (cell < grid.cols * (grid.rows - 1)) visit(cell + grid.cols);
}

function breaksUnderWeight(grid, cells, standing, attachTemperature) {
  const attachments = cells.filter((cell) => touchesStanding(grid, cell, standing));
  const moment = cells.length * lever(grid, cells, attachments);
  const heat = attachments.reduce((sum, cell) => sum + attachTemperature(cell), 0) / attachments.length;
  const hold = attachments.length * (1 - HEAT_WEAKENING * heat);
  return moment > CANTILEVER_STRENGTH * hold;
}

function touchesStanding(grid, cell, standing) {
  let touches = false;
  forEachNeighbour(grid, cell, (neighbour) => {
    if (standing[neighbour]) touches = true;
  });
  return touches;
}

function lever(grid, cells, attachments) {
  let total = 0;
  for (const cell of cells) {
    let nearest = Infinity;
    for (const attachment of attachments) nearest = Math.min(nearest, Math.abs((cell % grid.cols) - (attachment % grid.cols)));
    total += nearest;
  }
  return total / cells.length;
}
