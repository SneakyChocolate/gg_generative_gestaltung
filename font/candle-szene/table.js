import * as THREE from "three";
import { TABLE_Y } from "./config.js";

// TABLE: Partner ersetzt diese Funktion durch den echten Tisch, Oberfläche muss auf TABLE_Y liegen
export function createTable(scene) {
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = TABLE_Y;
  scene.add(table);
  return table;
}
