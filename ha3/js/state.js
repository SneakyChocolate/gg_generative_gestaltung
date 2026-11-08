import * as THREE from 'three';

// Gemeinsamer, veraenderlicher Zustand der laufenden Szene.
export const state = {
  ready: false,
  paused: false,
  resetting: false,
  elapsed: 0,
  time: 0,
  normalFrame: 0,
  wind: new THREE.Vector3(),
  windTarget: new THREE.Vector3(),
  fps: 60,
  fpsFrames: 0,
  fpsTime: 0,
  model: null,
  wicks: [],
  parts: [],
  drops: null,
  puddles: null,
  shards: null,
  smoke: [],
  smokeTimer: 0,
};
