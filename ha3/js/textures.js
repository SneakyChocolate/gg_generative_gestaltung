import * as THREE from 'three';
import { rand } from './utils.js';

// Alle Texturen werden zur Laufzeit mit Canvas 2D erzeugt.

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function finishTexture(canvas, { srgb = false, repeat = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  texture.anisotropy = 4;
  return texture;
}

// Weicher runder Fleck (Glow, Staub, Rauch).
export function makeSoftTexture(size = 128, inner = 'rgba(255,255,255,1)') {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.28, 'rgba(255,255,255,0.72)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finishTexture(canvas, { srgb: true });
}

// Flaemmchen-Textur: weisser Kern, gelbe Mitte, oranger Rand.
export function makeFlameTexture(size = 128) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size * 0.58, 0, size / 2, size * 0.58, size * 0.52);
  g.addColorStop(0.0, 'rgba(255,255,248,1)');
  g.addColorStop(0.16, 'rgba(255,248,190,0.98)');
  g.addColorStop(0.36, 'rgba(255,214,110,0.92)');
  g.addColorStop(0.62, 'rgba(255,135,32,0.55)');
  g.addColorStop(0.84, 'rgba(255,64,8,0.16)');
  g.addColorStop(1.0, 'rgba(255,40,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finishTexture(canvas, { srgb: true });
}

// Rauch: mehrere weiche, leicht versetzte Wolken.
export function makeSmokeTexture(size = 128) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 7; i++) {
    const x = size * rand(0.32, 0.68);
    const y = size * rand(0.3, 0.7);
    const r = size * rand(0.12, 0.3);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return finishTexture(canvas, { srgb: true });
}

// Holz: dunkle Grundierung, wellige Jahresringe, feine Poren.
export function makeWoodTexture(width = 1024, height = 512) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b1a11';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 90; i++) {
    const y0 = (i / 90) * height + rand(-8, 8);
    const amplitude = rand(2, 13);
    const frequency = rand(0.004, 0.012);
    ctx.beginPath();
    for (let x = 0; x <= width; x += 12) {
      const y = y0 + Math.sin(x * frequency + i * 1.7) * amplitude + Math.sin(x * 0.003 + i) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(110,66,35,0.24)' : 'rgba(15,8,4,0.18)';
    ctx.lineWidth = rand(0.6, 2.2);
    ctx.stroke();
  }

  // Poren / Staub.
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '150,95,52' : '8,4,2'},${rand(0.03, 0.13)})`;
    ctx.beginPath();
    ctx.ellipse(rand(0, width), rand(0, height), rand(0.5, 3.5), rand(0.4, 1.8), rand(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }

  return finishTexture(canvas, { srgb: true, repeat: true });
}

// Dunkelgruener Stoff fuer den Laeufer unter der Kerze.
export function makeRunnerTexture(width = 512, height = 256) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#13251a';
  ctx.fillRect(0, 0, width, height);

  // Webstruktur: winzige helle und dunkle Fadenkreuze.
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const light = Math.random() > 0.55;
      ctx.fillStyle = light ? 'rgba(80,110,74,0.09)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, y, 3, 1);
      ctx.fillRect(x, y, 1, 3);
    }
  }

  // Zwei schmale Goldkanten.
  ctx.fillStyle = 'rgba(183,136,68,0.55)';
  ctx.fillRect(0, 0, width, 3);
  ctx.fillRect(0, height - 3, width, 3);

  return finishTexture(canvas, { srgb: true, repeat: true });
}

// Hintergrund: dunkler Raum mit warmem Lichtschein hinter dem Wort.
export function makeBackdropTexture(width = 1024, height = 512) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#040302');
  base.addColorStop(0.52, '#0b0705');
  base.addColorStop(1, '#1b1009');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.5, height * 0.58, 0, width * 0.5, height * 0.58, width * 0.5);
  glow.addColorStop(0, 'rgba(120,58,18,0.30)');
  glow.addColorStop(0.45, 'rgba(70,32,10,0.12)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Ganz feines Korn gegen Banding.
  for (let i = 0; i < 9000; i++) {
    const a = Math.random() * 0.025;
    ctx.fillStyle = `rgba(255,220,170,${a})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
  }

  return finishTexture(canvas, { srgb: true });
}

// Zentrale Texturensammlung; von Materialien und Systemen gemeinsam benutzt.
export const textures = {
  soft: makeSoftTexture(128),
  flame: makeFlameTexture(128),
  smoke: makeSmokeTexture(128),
  wood: makeWoodTexture(),
  runner: makeRunnerTexture(),
  backdrop: makeBackdropTexture(),
};

textures.wood.repeat.set(2.4, 1.5);
textures.runner.repeat.set(3.2, 1.0);
