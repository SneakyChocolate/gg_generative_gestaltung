import * as THREE from 'three';
import { CONFIG, COLORS } from '../config.js';
import { scene } from '../renderer.js';
import { makeCanvas } from '../textures.js';
import { clamp, lerp } from '../utils.js';

// Pfuetzen: addition von Metaballfeldern auf Canvas 2D oder Instanz-Discs.

export class PuddleSystem {
  constructor() {
    this.puddles = [];
    this.mode = CONFIG.physicsMode;

    this.colorCanvas = makeCanvas(CONFIG.puddles.canvasWidth, 256);
    this.colorCtx = this.colorCanvas.getContext('2d');
    this.fieldCanvas = makeCanvas(CONFIG.puddles.canvasWidth, 256);
    this.fieldCtx = this.fieldCanvas.getContext('2d');

    this.colorTexture = new THREE.CanvasTexture(this.colorCanvas);
    this.colorTexture.colorSpace = THREE.SRGBColorSpace;
    this.colorTexture.minFilter = THREE.LinearFilter;
    this.colorTexture.magFilter = THREE.LinearFilter;
    this.colorTexture.generateMipmaps = false;

    this.fieldTexture = new THREE.CanvasTexture(this.fieldCanvas);
    this.fieldTexture.colorSpace = THREE.NoColorSpace;
    this.fieldTexture.minFilter = THREE.LinearFilter;
    this.fieldTexture.magFilter = THREE.LinearFilter;
    this.fieldTexture.generateMipmaps = false;

    this.material = new THREE.MeshPhysicalMaterial({
      map: this.colorTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      alphaTest: 0.012,
      roughness: 0.2,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.18,
      bumpMap: this.fieldTexture,
      bumpScale: 0.085,
      envMapIntensity: 0.85,
      emissive: new THREE.Color(0x1a0802),
      emissiveIntensity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.frustumCulled = false;
    this.plane.renderOrder = 1;
    scene.add(this.plane);

    // PHYSICS: Alternative Darstellung — einzelne abgeflachte Tropfen.
    this.discMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.8,
      emissive: new THREE.Color(0x170702),
      emissiveIntensity: 0.35,
    });
    this.discs = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 18, 9),
      this.discMaterial,
      CONFIG.puddles.max,
    );
    this.discs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.discs.frustumCulled = false;
    this.discs.count = 0;
    scene.add(this.discs);

    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.width = 8;
    this.depth = CONFIG.puddles.depth;
    this.minX = -4;
    this.maxX = 4;
    this.minZ = -this.depth / 2;
    this.maxZ = this.depth / 2;
    this.heightPx = 256;
  }

  configureBounds(wordWidth) {
    this.width = Math.max(6, wordWidth + CONFIG.puddles.margin * 2);
    this.depth = CONFIG.puddles.depth;
    this.minX = -this.width / 2;
    this.maxX = this.width / 2;
    this.minZ = -this.depth / 2;
    this.maxZ = this.depth / 2;

    // Canvas-Aspect = Welt-Aspect, damit ein runder Tropfen auch in der
    // Textur rund bleibt.
    this.heightPx = Math.max(160, Math.round(
      CONFIG.puddles.canvasWidth * this.depth / this.width,
    ));
    this.colorCanvas.height = this.heightPx;
    this.fieldCanvas.height = this.heightPx;

    this.plane.geometry.dispose();
    this.plane.geometry = new THREE.PlaneGeometry(this.width, this.depth);
    this.plane.position.set(0, CONFIG.tableY + 0.006, 0);
    this.clearCanvases();
    this.setMode(this.mode);
  }

  setMode(mode) {
    this.mode = mode;
    this.plane.visible = mode === 'metaballs';
    this.discs.visible = mode === 'discs';
    if (mode === 'discs') this.updateDiscs();
  }

  add(x, z, volume, temp) {
    const safeX = clamp(x, this.minX + 0.08, this.maxX - 0.08);
    const safeZ = clamp(z, this.minZ + 0.08, this.maxZ - 0.08);
    this.puddles.push({
      x: safeX,
      z: safeZ,
      volume: Math.max(0.00002, volume),
      thickness: CONFIG.puddles.thicknessStart,
      temp: clamp(temp, 0.2, 1),
      age: 0,
    });
    this.merge();
  }

  radiusOf(puddle) {
    return Math.sqrt(puddle.volume / (Math.PI * Math.max(0.001, puddle.thickness)));
  }

  update(dt) {
    for (const puddle of this.puddles) {
      puddle.age += dt;
      puddle.thickness = Math.max(
        CONFIG.puddles.thicknessMin,
        puddle.thickness - CONFIG.puddles.thicknessRate * dt,
      );
      puddle.temp = Math.max(0.16, puddle.temp - CONFIG.puddles.coolRate * dt);
    }

    this.merge();
    this.draw();

    if (this.mode === 'discs') this.updateDiscs();
  }

  // Logisches Verschmelzen: Das Volumen bleibt erhalten, der neue
  // Mittelpunkt ist nach Volumen gewichtet. Die sichtbare Verschmelzung
  // uebernimmt beim Metaball-Modus zusaetzlich das addierte Feld.
  merge() {
    let changed = true;
    while (changed && this.puddles.length > 1) {
      changed = false;
      for (let i = 0; i < this.puddles.length && !changed; i++) {
        for (let j = i + 1; j < this.puddles.length; j++) {
          const a = this.puddles[i];
          const b = this.puddles[j];
          const dx = a.x - b.x;
          const dz = a.z - b.z;
          const distance = Math.hypot(dx, dz);
          const reach = (this.radiusOf(a) + this.radiusOf(b)) * CONFIG.puddles.mergeFactor;
          if (distance > reach) continue;

          const volumeA = a.volume;
          const volumeB = b.volume;
          const total = volumeA + volumeB;
          a.x = (a.x * volumeA + b.x * volumeB) / total;
          a.z = (a.z * volumeA + b.z * volumeB) / total;
          a.thickness = (a.thickness * volumeA + b.thickness * volumeB) / total;
          a.temp = (a.temp * volumeA + b.temp * volumeB) / total;
          a.volume = total;
          a.age = Math.max(a.age, b.age);
          this.puddles.splice(j, 1);
          changed = true;
          break;
        }
      }
    }

    // Notbremse: nie mehr als das konfigurierte Maximum.
    while (this.puddles.length > CONFIG.puddles.max) {
      this.puddles.sort((a, b) => a.volume - b.volume);
      const small = this.puddles.shift();
      const into = this.puddles[0];
      const total = into.volume + small.volume;
      into.x = (into.x * into.volume + small.x * small.volume) / total;
      into.z = (into.z * into.volume + small.z * small.volume) / total;
      into.volume = total;
    }
  }

  draw() {
    const W = this.colorCanvas.width;
    const H = this.colorCanvas.height;
    this.colorCtx.clearRect(0, 0, W, H);
    this.fieldCtx.clearRect(0, 0, W, H);

    if (this.puddles.length === 0) {
      this.colorTexture.needsUpdate = true;
      this.fieldTexture.needsUpdate = true;
      return;
    }

    this.colorCtx.globalCompositeOperation = 'lighter';
    this.fieldCtx.globalCompositeOperation = 'lighter';

    for (const puddle of this.puddles) {
      const radius = this.radiusOf(puddle) * 1.16;
      const cx = ((puddle.x - this.minX) / this.width) * W;
      const cy = ((puddle.z - this.minZ) / this.depth) * H;
      const rp = Math.max(2.0, (radius / this.width) * W);

      const warm = clamp(puddle.temp, 0, 1);
      const red = Math.round(lerp(COLORS.puddleCool[0], COLORS.puddleWarm[0], warm) * 255);
      const green = Math.round(lerp(COLORS.puddleCool[1], COLORS.puddleWarm[1], warm) * 255);
      const blue = Math.round(lerp(COLORS.puddleCool[2], COLORS.puddleWarm[2], warm) * 255);

      const colorGradient = this.colorCtx.createRadialGradient(cx, cy, 0, cx, cy, rp);
      colorGradient.addColorStop(0.0, `rgba(${red},${green},${blue},0.96)`);
      colorGradient.addColorStop(0.52, `rgba(${red},${green},${blue},0.9)`);
      colorGradient.addColorStop(0.83, `rgba(${red},${green},${blue},0.34)`);
      colorGradient.addColorStop(1.0, `rgba(${red},${green},${blue},0)`);
      this.colorCtx.fillStyle = colorGradient;
      this.colorCtx.beginPath();
      this.colorCtx.arc(cx, cy, rp, 0, Math.PI * 2);
      this.colorCtx.fill();

      // Feld fuer den Bump: heller Kern, schwarzer Rand. Die Addition
      // mehrerer Felder erzeugt den weichen Uebergang.
      const fieldGradient = this.fieldCtx.createRadialGradient(cx, cy, 0, cx, cy, rp);
      fieldGradient.addColorStop(0.0, 'rgba(255,255,255,1)');
      fieldGradient.addColorStop(0.55, 'rgba(150,150,150,1)');
      fieldGradient.addColorStop(0.85, 'rgba(35,35,35,1)');
      fieldGradient.addColorStop(1.0, 'rgba(0,0,0,1)');
      this.fieldCtx.fillStyle = fieldGradient;
      this.fieldCtx.beginPath();
      this.fieldCtx.arc(cx, cy, rp, 0, Math.PI * 2);
      this.fieldCtx.fill();
    }

    this.colorCtx.globalCompositeOperation = 'source-over';
    this.fieldCtx.globalCompositeOperation = 'source-over';
    this.colorTexture.needsUpdate = true;
    this.fieldTexture.needsUpdate = true;
  }

  updateDiscs() {
    this.discs.count = Math.min(this.puddles.length, CONFIG.puddles.max);
    for (let i = 0; i < this.discs.count; i++) {
      const puddle = this.puddles[i];
      const radius = this.radiusOf(puddle);
      this.dummy.position.set(
        puddle.x,
        CONFIG.tableY + puddle.thickness * 0.36,
        puddle.z,
      );
      this.dummy.scale.set(radius, puddle.thickness * 0.55, radius);
      this.dummy.updateMatrix();
      this.discs.setMatrixAt(i, this.dummy.matrix);

      const warm = clamp(puddle.temp, 0, 1);
      this.color.setRGB(
        lerp(COLORS.puddleCool[0], COLORS.puddleWarm[0], warm),
        lerp(COLORS.puddleCool[1], COLORS.puddleWarm[1], warm),
        lerp(COLORS.puddleCool[2], COLORS.puddleWarm[2], warm),
      );
      this.discs.setColorAt(i, this.color);
    }
    this.discs.instanceMatrix.needsUpdate = true;
    if (this.discs.instanceColor) this.discs.instanceColor.needsUpdate = true;
  }

  clearCanvases() {
    this.colorCtx.clearRect(0, 0, this.colorCanvas.width, this.colorCanvas.height);
    this.fieldCtx.clearRect(0, 0, this.fieldCanvas.width, this.fieldCanvas.height);
    this.colorTexture.needsUpdate = true;
    this.fieldTexture.needsUpdate = true;
  }

  clear() {
    this.puddles.length = 0;
    this.clearCanvases();
    this.discs.count = 0;
    this.discs.instanceMatrix.needsUpdate = true;
  }
}
