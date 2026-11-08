import { GRAVITY, TABLE_Y, CRATER, TIP_MAX_ANGLE, TIP_DISTANCE, SEAM_MARGIN, REST_GAP } from "./config.js";
import { heightAt, updateSurface } from "./surface.js";

export function breakOff(letter, breakage, cells, burn) {
  const index = letter.mesh.geometry.getIndex();
  const triangles = cells.flatMap((cell) => breakage.cellTriangles[cell]).filter((triangle) => !isDegenerate(index.array, triangle));
  const shared = sharedVertices(letter, index.array, triangles);
  if (letter.vertexCount + shared.length > letter.capacity) return null;
  const firstCopy = letter.vertexCount;
  const copies = new Map(shared.map((vertex) => [vertex, duplicateVertex(letter, vertex)]));
  for (const triangle of triangles) {
    for (let corner = triangle * 3; corner < triangle * 3 + 3; corner++) {
      if (copies.has(index.array[corner])) index.array[corner] = copies.get(index.array[corner]);
    }
  }
  index.needsUpdate = true;
  markDetached(breakage, cells);
  return connectedParts(index.array, triangles).map((part) => {
    const vertices = uniqueVertices(index.array, part);
    for (const vertex of vertices) {
      letter.falling[vertex] = 1;
      letter.floors[vertex] = TABLE_Y;
      removeBurnedWax(letter, vertex, burn);
    }
    return createPiece(letter, part, vertices, vertices.filter((vertex) => vertex >= firstCopy));
  });
}

export function updatePieces(letter, pieces, surface, dt) {
  for (const piece of pieces) {
    if (piece.landed) continue;
    piece.speed += -GRAVITY * dt;
    piece.distance += piece.speed * dt;
    piece.angle = -piece.tipDirection * TIP_MAX_ANGLE * Math.min(1, piece.distance / TIP_DISTANCE);
    placePiece(letter, piece);
    const gap = groundGap(letter, piece, surface);
    if (gap > 0) continue;
    piece.distance += gap;
    placePiece(letter, piece);
    setFalling(letter, piece, 0);
    piece.landed = true;
  }
}

export function releaseUnsupported(letter, pieces, surface) {
  let released = true;
  while (released) {
    released = false;
    for (const piece of pieces) {
      if (!piece.landed || lowestPoint(letter, piece) <= TABLE_Y + REST_GAP) continue;
      setFalling(letter, piece, 1);
      updateSurface(surface, letter);
      if (groundGap(letter, piece, surface) <= REST_GAP) {
        setFalling(letter, piece, 0);
        continue;
      }
      piece.landed = false;
      piece.speed = 0;
      released = true;
    }
  }
}

function isDegenerate(index, triangle) {
  const a = index[triangle * 3];
  const b = index[triangle * 3 + 1];
  const c = index[triangle * 3 + 2];
  return a === b || b === c || a === c;
}

function markDetached(breakage, cells) {
  for (const cell of cells) breakage.detached[cell] = 1;
}

function sharedVertices(letter, index, triangles) {
  const inPiece = new Uint8Array(index.length / 3);
  for (const triangle of triangles) inPiece[triangle] = 1;
  const usedByRest = new Uint8Array(letter.capacity);
  for (let triangle = 0; triangle < inPiece.length; triangle++) {
    if (inPiece[triangle] || isDegenerate(index, triangle)) continue;
    for (let corner = triangle * 3; corner < triangle * 3 + 3; corner++) usedByRest[index[corner]] = 1;
  }
  return uniqueVertices(index, triangles).filter((vertex) => usedByRest[vertex]);
}

function connectedParts(index, triangles) {
  const trianglesOfVertex = new Map();
  for (const triangle of triangles) {
    for (let corner = triangle * 3; corner < triangle * 3 + 3; corner++) {
      if (!trianglesOfVertex.has(index[corner])) trianglesOfVertex.set(index[corner], []);
      trianglesOfVertex.get(index[corner]).push(triangle);
    }
  }
  const visited = new Set();
  const parts = [];
  for (const first of triangles) {
    if (visited.has(first)) continue;
    visited.add(first);
    const part = [first];
    for (let next = 0; next < part.length; next++) {
      for (let corner = part[next] * 3; corner < part[next] * 3 + 3; corner++) {
        for (const neighbour of trianglesOfVertex.get(index[corner])) {
          if (visited.has(neighbour)) continue;
          visited.add(neighbour);
          part.push(neighbour);
        }
      }
    }
    parts.push(part);
  }
  return parts;
}

function uniqueVertices(index, triangles) {
  const vertices = new Set();
  for (const triangle of triangles) {
    for (let corner = triangle * 3; corner < triangle * 3 + 3; corner++) vertices.add(index[corner]);
  }
  return [...vertices];
}

function duplicateVertex(letter, vertex) {
  const copy = letter.vertexCount++;
  const geometry = letter.mesh.geometry;
  for (const values of [letter.rest, letter.base, letter.restNormals, geometry.getAttribute("position").array, geometry.getAttribute("color").array]) {
    values.copyWithin(copy * 3, vertex * 3, vertex * 3 + 3);
  }
  for (const values of [letter.deposit, letter.temperatures, letter.floors, letter.falling]) values[copy] = values[vertex];
  return copy;
}

function removeBurnedWax(letter, vertex, burn) {
  const { base, wick } = letter;
  const dx = base[vertex * 3] - wick.x;
  const dz = base[vertex * 3 + 2] - wick.z;
  base[vertex * 3 + 1] = Math.min(base[vertex * 3 + 1], burn + CRATER * (dx * dx + dz * dz));
}

function createPiece(letter, triangles, vertices, seam) {
  const start = new Float32Array(vertices.length * 3);
  vertices.forEach((vertex, k) => start.set(letter.base.subarray(vertex * 3, vertex * 3 + 3), k * 3));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  for (let k = 0; k < vertices.length; k++) {
    minX = Math.min(minX, start[k * 3]);
    maxX = Math.max(maxX, start[k * 3]);
    minY = Math.min(minY, start[k * 3 + 1]);
  }
  const tipDirection = (minX + maxX) / 2 >= letter.wick.x ? 1 : -1;
  return {
    triangles,
    vertices,
    start,
    touchesGround: touchesGround(letter, vertices, seam),
    pivotX: tipDirection > 0 ? minX : maxX,
    pivotY: minY,
    tipDirection,
    angle: 0,
    distance: 0,
    speed: 0,
    landed: false,
  };
}

function touchesGround(letter, vertices, seam) {
  const seamX = seam.map((vertex) => letter.base[vertex * 3]);
  return Uint8Array.from(vertices, (vertex) => {
    const x = letter.base[vertex * 3];
    return seamX.every((edgeX) => Math.abs(x - edgeX) > SEAM_MARGIN) ? 1 : 0;
  });
}

function placePiece(letter, piece) {
  const { base } = letter;
  const { start, pivotX, pivotY, distance } = piece;
  const cos = Math.cos(piece.angle);
  const sin = Math.sin(piece.angle);
  if (piece.vertices === undefined) return;
  for (let k = 0; k < piece.vertices.length; k++) {
    const i = piece.vertices[k] * 3;
    const dx = start[k * 3] - pivotX;
    const dy = start[k * 3 + 1] - pivotY;
    base[i] = pivotX + cos * dx - sin * dy;
    base[i + 1] = pivotY + sin * dx + cos * dy - distance;
    base[i + 2] = start[k * 3 + 2];
  }
}

function groundGap(letter, piece, surface) {
  const { base } = letter;
  let gap = Infinity;
  if (piece.vertices === undefined) return gap;
  for (let k = 0; k < piece.vertices.length; k++) {
    const i = piece.vertices[k] * 3;
    const ground = piece.touchesGround[k] ? Math.max(TABLE_Y, heightAt(surface, base[i], base[i + 2])) : TABLE_Y;
    gap = Math.min(gap, base[i + 1] - ground);
  }
  return gap;
}

function lowestPoint(letter, piece) {
  let lowest = Infinity;
  for (const vertex of piece.vertices) lowest = Math.min(lowest, letter.base[vertex * 3 + 1]);
  return lowest;
}

function setFalling(letter, piece, value) {
  for (const vertex of piece.vertices) letter.falling[vertex] = value;
}
