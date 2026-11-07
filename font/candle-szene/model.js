import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import * as CONFIG from "./config.js";
import { buildGrid, cellIndex, floorOf, tallestColumnX } from "./grid.js";

export async function loadLetters(material) {
  let geometries;
  try {
    geometries = await loadSourceGeometries(CONFIG.MODEL_SOURCE);
  } catch (error) {
    console.warn("Modell nicht geladen, nutze Fallback-Zylinder:", error);
    geometries = fallbackGeometries();
  }
  return arrangeInRow(geometries).map(densify).map((geometry) => createLetter(geometry, material));
}

async function loadSourceGeometries(source) {
  // MODEL: neue Modellquelle hier ergänzen
  if (source === "text") return textGeometries();
  if (source === "gltf") return gltfGeometries();
  return fallbackGeometries();
}

async function textGeometries() {
  const font = await new FontLoader().loadAsync(CONFIG.FONT_URL);
  return [...CONFIG.WORD].map((character) => new TextGeometry(character, {
    font,
    size: CONFIG.LETTER_SIZE,
    height: CONFIG.LETTER_DEPTH,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: CONFIG.BEVEL,
    bevelSize: CONFIG.BEVEL,
    bevelSegments: 2,
  }));
}

async function gltfGeometries() {
  const gltf = await new GLTFLoader().loadAsync(CONFIG.GLTF_URL);
  gltf.scene.updateMatrixWorld(true);
  const geometries = [];
  gltf.scene.traverse((child) => {
    if (child.isMesh) geometries.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
  });
  if (geometries.length !== CONFIG.WORD.length) throw new Error(`glTF hat ${geometries.length} Meshes, erwartet ${CONFIG.WORD.length}`);
  return geometries.sort((a, b) => boundingBox(a).min.x - boundingBox(b).min.x);
}

function fallbackGeometries() {
  return [...CONFIG.WORD].map(() => new THREE.CylinderGeometry(0.3, 0.3, CONFIG.LETTER_SIZE, 24, 1));
}

function boundingBox(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox;
}

function arrangeInRow(geometries) {
  let cursor = 0;
  for (const geometry of geometries) {
    const box = boundingBox(geometry).clone();
    const scale = CONFIG.LETTER_SIZE / (box.max.y - box.min.y);
    geometry.translate(-box.min.x, -box.min.y, -(box.min.z + box.max.z) / 2);
    geometry.scale(scale, scale, scale);
    geometry.translate(cursor, CONFIG.TABLE_Y, 0);
    cursor += (box.max.x - box.min.x) * scale + CONFIG.LETTER_GAP;
  }
  const shift = -(cursor - CONFIG.LETTER_GAP) / 2;
  geometries.forEach((geometry) => geometry.translate(shift, 0, 0));
  return geometries;
}

function densify(geometry) {
  const positionsOnly = new THREE.BufferGeometry();
  positionsOnly.setAttribute("position", geometry.getAttribute("position"));
  positionsOnly.setIndex(geometry.getIndex());
  const dense = new TessellateModifier(CONFIG.TESSELLATE_EDGE, CONFIG.TESSELLATE_ITERATIONS).modify(positionsOnly);
  const merged = mergeVertices(dense);
  merged.computeVertexNormals();
  return merged;
}

function createLetter(geometry, material) {
  const rest = geometry.getAttribute("position").array.slice();
  const vertexCount = rest.length / 3;
  geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(rest.length), 3));
  const grid = buildGrid(rest);
  const floors = new Float32Array(vertexCount);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    floors[vertex] = floorOf(grid, cellIndex(grid, rest[vertex * 3], rest[vertex * 3 + 1]));
  }
  const box = boundingBox(geometry).clone();
  const wick = new THREE.Vector3(tallestColumnX(grid), box.max.y, (box.min.z + box.max.z) / 2);
  const reach = Math.hypot(Math.max(box.max.x - wick.x, wick.x - box.min.x), box.max.z - wick.z);
  return {
    mesh: new THREE.Mesh(geometry, material),
    rest,
    floors,
    grid,
    wick,
    box,
    temperatures: new Float32Array(vertexCount),
    top: box.max.y,
    bottom: CONFIG.TABLE_Y - CONFIG.CRATER * reach * reach,
    burning: true,
  };
}
