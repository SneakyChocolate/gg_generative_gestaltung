import * as THREE from 'three';

const SOUND_FILES = ['normal_bang'].map((name) => `./sound/${name}.wav`);
const VOLUME = 0.5;
const REF_DISTANCE = 30;
const ROLLOFF = 1.2;

const ctx = new AudioContext();
const master = ctx.createGain();
master.gain.value = VOLUME;
master.connect(ctx.destination);

const buffers = [];
SOUND_FILES.forEach(async (file) => {
  const data = await (await fetch(file)).arrayBuffer();
  buffers.push(await ctx.decodeAudioData(data));
});

let muted = false;

export function updateListener(camera) {
  const { listener } = ctx;
  const forward = camera.getWorldDirection(new THREE.Vector3());
  listener.positionX.value = camera.position.x;
  listener.positionY.value = camera.position.y;
  listener.positionZ.value = camera.position.z;
  listener.forwardX.value = forward.x;
  listener.forwardY.value = forward.y;
  listener.forwardZ.value = forward.z;
  listener.upX.value = camera.up.x;
  listener.upY.value = camera.up.y;
  listener.upZ.value = camera.up.z;
}

export function playExplosion(x, y, z) {
  if (muted || ctx.state !== 'running' || buffers.length === 0) return;
  const source = ctx.createBufferSource();
  source.buffer = buffers[Math.floor(Math.random() * buffers.length)];
  const panner = new PannerNode(ctx, {
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    refDistance: REF_DISTANCE,
    rolloffFactor: ROLLOFF,
    positionX: x,
    positionY: y,
    positionZ: z,
  });
  source.connect(panner).connect(master);
  source.start();
}

window.addEventListener('pointerdown', () => ctx.resume());
window.addEventListener('keydown', (event) => {
  ctx.resume();
  if (event.key.toLowerCase() !== 'm') return;
  muted = !muted;
  master.gain.value = muted ? 0 : VOLUME;
});
