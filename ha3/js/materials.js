import * as THREE from 'three';
import { COLORS } from './config.js';
import { textures } from './textures.js';

// Alle Materialien an einer Stelle. Sie teilen sich die prozeduralen Texturen.
export const materials = {
  wax: new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.8,
    sheen: 0.45,
    sheenColor: new THREE.Color(0xffd6a0),
    sheenRoughness: 0.62,
    envMapIntensity: 0.45,
    emissive: new THREE.Color(0x180902),
    emissiveIntensity: 0.55,
    // Nach dem echten Schnitt sind alle Bruchflaechen gecappt. FrontSide
    // verhindert, dass man durch offene Stellen ins Mesh-Innere sieht.
    side: THREE.FrontSide,
  }),

  wick: new THREE.MeshStandardMaterial({
    color: 0x2a1a10,
    roughness: 0.95,
    metalness: 0.0,
  }),

  drop: new THREE.MeshPhysicalMaterial({
    color: 0xffe5c0,
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.75,
    emissive: new THREE.Color(0x2a1003),
    emissiveIntensity: 0.6,
  }),

  table: new THREE.MeshStandardMaterial({
    color: 0x6a4529,
    map: textures.wood,
    roughness: 0.62,
    metalness: 0.04,
    bumpMap: textures.wood,
    bumpScale: 0.018,
    envMapIntensity: 0.18,
  }),

  runner: new THREE.MeshStandardMaterial({
    color: 0x294531,
    map: textures.runner,
    roughness: 0.94,
    metalness: 0.0,
    bumpMap: textures.runner,
    bumpScale: 0.006,
  }),

  gold: new THREE.MeshPhysicalMaterial({
    color: 0xb7843e,
    metalness: 1.0,
    roughness: 0.22,
    envMapIntensity: 1.15,
  }),

  baubleRed: new THREE.MeshPhysicalMaterial({
    color: 0x7e1717,
    metalness: 0.55,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.25,
  }),

  fir: new THREE.MeshStandardMaterial({
    color: 0x183323,
    roughness: 0.92,
    metalness: 0.0,
  }),

  flameOuter: new THREE.SpriteMaterial({
    map: textures.soft,
    color: COLORS.flameOuter,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  }),

  flameMain: new THREE.SpriteMaterial({
    map: textures.flame,
    color: COLORS.flameMain,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  }),

  flameCore: new THREE.SpriteMaterial({
    map: textures.flame,
    color: COLORS.flameCore,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  }),

  flameBlue: new THREE.SpriteMaterial({
    map: textures.soft,
    color: COLORS.flameBlue,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  }),
};

// Shards benutzen dasselbe Wachsmaterial. Auch sie sind nach dem Schnitt
// geschlossen und brauchen deshalb keine sichtbaren Rueckseiten.
materials.shard = materials.wax.clone();
materials.shard.side = THREE.FrontSide;
