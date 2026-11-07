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
