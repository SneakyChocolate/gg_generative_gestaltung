import { init, frame } from './js/engine.js';

// p5.js-konformer Einstiegspunkt: setup() baut die Szene einmal auf,
// draw() wird vom Runner in main.js einmal pro Frame aufgerufen.
// Alle eigentliche Logik liegt in den uebrigen Modulen.
export async function setup() {
  await init();
}

export function draw() {
  frame();
}
