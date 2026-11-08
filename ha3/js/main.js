import { setup, draw } from '../sketch.js';

// Kleiner p5.js-konformer Runner. Da die Szene Three.js benutzt, uebernimmt
// diese Datei die Aufgabe, die sonst p5.js mit setup()/draw() erledigt.
async function start() {
  await setup();
  const loop = () => {
    draw();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

start();
