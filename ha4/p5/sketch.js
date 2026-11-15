// Daniel Shiffman
// http://codingtra.in
// https://youtu.be/CKeyIbT3vXI

const fireworks = [];
let gravity;
let flow;
const FLOW_SCALE = 0.0015;
const FLOW_SPEED = 0.004;
const FLOW_STRENGTH = 10;
const flowForce = new p5.Vector();
const SMOKE_FLOW_STRENGTH = 40;
const SMOKE_RISE = 0.03;
const SMOKE_CHANCE = 0.05;
let clean;
let flareMid;
let flareSource;
let flare;
let bloom;

function setup() {
  createCanvas(windowWidth, windowHeight);
  flare = new LensFlare({ threshold: 0.05, intensity: 4 });
  bloom = new DualBloom({ threshold: 0.2, intensity: 3 });
  clean = createGraphics(width, height);
  flareMid = createGraphics(flare.buffer.width * 2, flare.buffer.height * 2);
  flareMid.pixelDensity(1);
  flareSource = createGraphics(flare.buffer.width, flare.buffer.height);
  flareSource.pixelDensity(1);
  colorMode(HSB);
  gravity = createVector(0, 0.2);
  stroke(255);
  strokeWeight(4);
  background(0);
}

function draw() {
  image(clean, 0, 0, width, height);
  colorMode(RGB);
  background(0, 0, 0, 25);
  flow = noisePotential2D(FLOW_SCALE, frameCount * FLOW_SPEED);

  if (random(1) < 0.04) {
    fireworks.push(new Firework());
  }

  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    fireworks[i].show();

    if (fireworks[i].done()) {
      fireworks.splice(i, 1);
    }
  }

  const canvas = drawingContext.canvas;
  clean.drawingContext.drawImage(canvas, 0, 0, width, height);
  // flareMid.drawingContext.drawImage(canvas, 0, 0, flareMid.width, flareMid.height);
  // flareSource.drawingContext.drawImage(flareMid.elt, 0, 0, flareSource.width, flareSource.height);
  // flare.draw(flareSource);
  bloom.draw(clean.elt);
}
