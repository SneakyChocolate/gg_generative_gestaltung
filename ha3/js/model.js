import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { materials } from './materials.js';
import { createPart } from './physics/candle-part.js';
import { Wick } from './systems/wick.js';

// Modellquelle: TextGeometry, externes GLB/GLTF/OBJ oder Fallback-Zylinder.

async function loadFont() {
  const loader = new FontLoader();
  try {
    return await loader.loadAsync(CONFIG.text.fontUrl);
  } catch (error) {
    console.warn('Gentilis konnte nicht geladen werden, versuche Helvetiker.', error);
    return await loader.loadAsync(CONFIG.text.fallbackFontUrl);
  }
}

function makeTextGeometry(character, font) {
  let geometry = new TextGeometry(character, {
    font,
    size: CONFIG.text.size,
    height: CONFIG.text.depth,
    curveSegments: CONFIG.text.curveSegments,
    bevelEnabled: true,
    bevelThickness: CONFIG.text.bevelThickness,
    bevelSize: CONFIG.text.bevelSize,
    bevelOffset: 0,
    bevelSegments: CONFIG.text.bevelSegments,
  });
  if (geometry.index) {
    const nonIndexed = geometry.toNonIndexed();
    geometry.dispose();
    geometry = nonIndexed;
  }
  return geometry;
}

// Jeder Buchstabe ist ein eigenes Mesh. Dadurch sitzt genau ein Docht
// auf jedem Buchstaben und ein Bruch kann nur diesen Buchstaben treffen.
function createTextModel(font) {
  const group = new THREE.Group();
  const entries = [];
  let cursor = 0;

  for (const character of CONFIG.word) {
    if (character === ' ' || character === '\n') {
      cursor += CONFIG.text.size * 0.46;
      continue;
    }

    const geometry = makeTextGeometry(character, font);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const width = box.max.x - box.min.x;

    // Auf linke Kante, Unterkante und z-Mitte legen.
    geometry.translate(
      -box.min.x,
      -box.min.y,
      -(box.min.z + box.max.z) / 2,
    );
    geometry.computeBoundingBox();

    const mesh = new THREE.Mesh(geometry, materials.wax);
    mesh.position.set(cursor, 0, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    entries.push({ mesh, width });
    cursor += width + CONFIG.text.spacing;
  }

  const totalWidth = Math.max(0.1, cursor - CONFIG.text.spacing);
  const shift = -totalWidth / 2;
  for (const entry of entries) {
    entry.mesh.position.x += shift;
  }
  group.updateMatrixWorld(true);

  const parts = entries.map((entry, index) => createPart(entry.mesh, index));
  const wicks = parts.map((part, index) => {
    const anchor = findWickAnchors(part.geometry, part.bbox, 1)[0];
    const wick = new Wick(part, anchor, index);
    part.heatWicks = [wick];
    return wick;
  });

  return { group, parts, wicks, width: totalWidth, kind: 'text' };
}

// Geometrie fuer den generischen Pfad: nur Position und Normale behalten,
// damit sich verschiedene Blender-Teile sicher verschmelzen lassen.
function sanitizeGeometry(geometry) {
  let result = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const name of Object.keys(result.attributes)) {
    if (name !== 'position' && name !== 'normal') result.deleteAttribute(name);
  }
  if (!result.attributes.normal) result.computeVertexNormals();
  return result;
}

async function loadExternalGeometry(url) {
  if (!url) throw new Error('CONFIG.externalModelUrl ist leer.');

  const clean = url.split('?')[0].toLowerCase();
  let root;
  if (clean.endsWith('.obj')) {
    root = await new OBJLoader().loadAsync(url);
  } else if (clean.endsWith('.glb') || clean.endsWith('.gltf')) {
    root = (await new GLTFLoader().loadAsync(url)).scene;
  } else {
    throw new Error('Unbekanntes Modellformat: ' + url);
  }

  root.updateMatrixWorld(true);
  const geometries = [];
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geometry = sanitizeGeometry(child.geometry.clone());
    geometry.applyMatrix4(child.matrixWorld);
    geometries.push(geometry);
  });

  if (geometries.length === 0) throw new Error('Das Modell enthaelt keine Meshes.');
  const merged = mergeGeometries(geometries, false);
  if (!merged) {
    console.warn('Geometrien konnten nicht verschmolzen werden; nutze erstes Mesh.');
    return geometries[0];
  }
  return merged;
}

// Externe Modelle und Fallback werden auf dieselbe Hoehe gebracht und
// mit einem oder mehreren Dochten versehen. Damit ist der Loader
// austauschbar, ohne dass die restliche Simulation etwas merkt.
function createGenericModel(geometry, kind) {
  let result = geometry;
  if (result.index) {
    const nonIndexed = result.toNonIndexed();
    result.dispose();
    result = nonIndexed;
  }

  result.computeBoundingBox();
  const firstBox = result.boundingBox;
  const firstSize = new THREE.Vector3();
  firstBox.getSize(firstSize);
  const targetHeight = 1.55;
  const scale = targetHeight / Math.max(firstSize.y, 1e-4);
  result.scale(scale, scale, scale);

  result.computeBoundingBox();
  const box = result.boundingBox;
  result.translate(
    -(box.min.x + box.max.x) / 2,
    -box.min.y,
    -(box.min.z + box.max.z) / 2,
  );
  result.computeBoundingBox();

  const mesh = new THREE.Mesh(result, materials.wax);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);

  const part = createPart(mesh, 0);
  const width = part.bbox.max.x - part.bbox.min.x;
  const wickCount = Math.max(1, Math.round(width / 1.15));
  const anchors = findWickAnchors(part.geometry, part.bbox, wickCount);
  const wicks = anchors.map((anchor, index) => new Wick(part, anchor, index));
  part.heatWicks = wicks;

  return { group, parts: [part], wicks, width, kind };
}

function createFallbackModel() {
  const geometry = new THREE.CylinderGeometry(0.64, 0.78, 1.55, 48, 1, false);
  return createGenericModel(geometry, 'fallback');
}

export async function loadModel() {
  if (CONFIG.model === 'external') {
    try {
      const geometry = await loadExternalGeometry(CONFIG.externalModelUrl);
      return createGenericModel(geometry, 'external');
    } catch (error) {
      console.warn('Externes Modell fehlgeschlagen, nutze Fallback-Zylinder.', error);
      return createFallbackModel();
    }
  }

  if (CONFIG.model === 'fallback') {
    return createFallbackModel();
  }

  try {
    const font = await loadFont();
    return createTextModel(font);
  } catch (error) {
    console.warn('Font/TextGeometry fehlgeschlagen, nutze Fallback-Zylinder.', error);
    return createFallbackModel();
  }
}

// Docht-Anker: Punkte auf der obersten Flaeche. Bei mehreren Dochten
// wird die Breite in Zonen geteilt, damit sie nicht alle in der Mitte sitzen.
function findWickAnchors(geometry, bbox, count) {
  const positions = geometry.attributes.position.array;
  const height = bbox.max.y - bbox.min.y;
  const topBand = Math.max(0.008, height * 0.035);
  const centerX = (bbox.min.x + bbox.max.x) / 2;
  const centerZ = (bbox.min.z + bbox.max.z) / 2;
  const candidates = [];

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (y >= bbox.max.y - topBand) candidates.push({ x, y, z });
  }

  if (candidates.length === 0) {
    return [new THREE.Vector3(centerX, bbox.max.y, centerZ)];
  }

  const anchors = [];
  for (let zone = 0; zone < count; zone++) {
    const zoneMin = bbox.min.x + ((bbox.max.x - bbox.min.x) * zone) / count;
    const zoneMax = bbox.min.x + ((bbox.max.x - bbox.min.x) * (zone + 1)) / count;
    const zoneCenter = (zoneMin + zoneMax) / 2;
    let best = null;
    let bestScore = Infinity;

    for (const candidate of candidates) {
      const inZone = candidate.x >= zoneMin && candidate.x <= zoneMax;
      const distanceToZone = Math.abs(candidate.x - zoneCenter);
      const score = (inZone ? 0 : 5) + distanceToZone + Math.abs(candidate.z - centerZ) * 0.3;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (best) anchors.push(new THREE.Vector3(best.x, best.y - 0.004, best.z));
  }

  return anchors.length ? anchors : [new THREE.Vector3(centerX, bbox.max.y, centerZ)];
}
