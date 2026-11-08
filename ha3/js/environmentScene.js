import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { scene } from './renderer.js';

// Laedt die Blender-Umgebung aus assets/scene.glb (Tisch, Hintergrund und
// die kleinen Kerzen). Die prozedurale Deko in environment.js bleibt bestehen;
// nur die dortige Tischplatte und Hintergrundwand werden nach erfolgreichem
// Laden ausgeblendet.

function findTableMesh(root) {
  let tableMesh = null;
  let bestFootprint = 0;

  root.traverse((child) => {
    if (!child.isMesh) return;
    const box = new THREE.Box3().setFromObject(child);
    const size = box.getSize(new THREE.Vector3());
    const footprint = size.x * size.z;
    if (footprint > bestFootprint) {
      bestFootprint = footprint;
      tableMesh = child;
    }
  });

  return tableMesh;
}

export async function loadEnvironmentScene(wordWidth) {
  const url = CONFIG.environment.url;
  if (!url) return null;

  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.name = 'environmentScene';
  root.updateMatrixWorld(true);

  // Die Tischplatte ist das Mesh mit der groessten Grundflaeche. Das ist
  // robuster als ein fest verdrahteter Knotenname aus Blender.
  const tableMesh = findTableMesh(root);
  if (!tableMesh) throw new Error('Die Umgebung enthaelt keine Tischplatte.');

  const tableSize = new THREE.Box3()
    .setFromObject(tableMesh)
    .getSize(new THREE.Vector3());
  const targetWidth = Math.max(
    wordWidth + CONFIG.environment.widthPadding,
    CONFIG.environment.minTableWidth,
  );
  const scale = targetWidth / Math.max(tableSize.x, 1e-4);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  // Nach dem Skalieren die Tischoberkante auf CONFIG.tableY legen. Damit
  // benutzen Tropfen, Pfuetzen, Splitter und das Wort dieselbe Ebene.
  const scaledTableBox = new THREE.Box3().setFromObject(tableMesh);
  root.position.set(
    CONFIG.environment.offsetX,
    CONFIG.tableY - scaledTableBox.max.y,
    CONFIG.environment.offsetZ,
  );
  root.updateMatrixWorld(true);

  root.traverse((child) => {
    if (!child.isMesh) return;
    // Der unlit Hintergrund (KHR_materials_unlit) soll keine Schatten
    // empfangen oder werfen; Tisch und Kerzen schon.
    const unlit = Boolean(child.material && child.material.isMeshBasicMaterial);
    child.castShadow = !unlit;
    child.receiveShadow = !unlit;
  });

  scene.add(root);

  const finalTableBox = new THREE.Box3().setFromObject(tableMesh);
  return {
    root,
    tableSize: finalTableBox.getSize(new THREE.Vector3()),
  };
}
