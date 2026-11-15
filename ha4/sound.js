const SOUND_FILES = ['big_explosion', 'normal_bang'].map((name) => `./sound/${name}.wav`);
const VOLUME = 0.01;
const PAN_RANGE = 60;

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

export function playExplosion(x) {
  if (muted || ctx.state !== 'running' || buffers.length === 0) return;
  const source = ctx.createBufferSource();
  source.buffer = buffers[Math.floor(Math.random() * buffers.length)];
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-1, Math.min(1, x / PAN_RANGE));
  source.connect(pan).connect(master);
  source.start();
}

window.addEventListener('pointerdown', () => ctx.resume());
window.addEventListener('keydown', (event) => {
  ctx.resume();
  if (event.key.toLowerCase() !== 'm') return;
  muted = !muted;
  master.gain.value = muted ? 0 : VOLUME;
});
