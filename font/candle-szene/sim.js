import * as THREE from "three";
const STEP = 0.05;
const targetSeconds = Number(new URLSearchParams(location.search).get("t") || 40);
THREE.Clock.prototype.getDelta = function () {
  this.elapsedTime += STEP;
  return STEP;
};
let frameCallback = null;
const realRequestAnimationFrame = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (callback) => {
  frameCallback = callback;
  return 1;
};
let drawing = false;
for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
  const original = WebGL2RenderingContext.prototype[name];
  WebGL2RenderingContext.prototype[name] = function (...args) {
    if (drawing) original.apply(this, args);
  };
}
await import("./main.js");
const frames = Math.round(targetSeconds / STEP);
const started = performance.now();
for (let frame = 0; frame < frames - 1; frame++) frameCallback(frame * 50);
const perFrame = (performance.now() - started) / (frames - 1);
drawing = true;
THREE.Clock.prototype.getDelta = () => 0;
window.requestAnimationFrame = realRequestAnimationFrame;
frameCallback(frames * 50);
document.getElementById("hud").textContent = `sim t=${targetSeconds}s`;
console.log(`SIM ${targetSeconds}s cpu ${perFrame.toFixed(2)} ms/frame`);
document.title = "done";
