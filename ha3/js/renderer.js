import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';

// Three.js-Grundobjekte, die von mehreren Modulen geteilt werden.
export const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.background);
scene.fog = new THREE.FogExp2(COLORS.fog, 0.018);

export const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 80);
camera.position.set(0.55, 3.0, 10);

export const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
