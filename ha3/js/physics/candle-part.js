import * as THREE from 'three';
import { CONFIG, COLORS } from '../config.js';
import { clamp, lerp, rand, smoothstep } from '../utils.js';
import { state } from '../state.js';
import {
  buildMeshTopology,
  fixDegenerateNormals,
  smoothGeometryNormals,
} from './topology.js';
import {
  sliceGeometry,
  buildSliceCaps,
  geometryFromArrays,
  meshVolume,
} from './slicing.js';

// Ein Buchstabe bzw. Modellteil: Waerme, Schmelzen, Farbe und Bruch.

export function createPart(mesh, id) {
  const geometry = mesh.geometry;
  if (!geometry.attributes.color) {
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    const attribute = new THREE.BufferAttribute(colors, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('color', attribute);
  }
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  if (geometry.attributes.normal) geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  geometry.attributes.color.setUsage(THREE.DynamicDrawUsage);
  geometry.computeBoundingBox();

  return new CandlePart(mesh, geometry, geometry.boundingBox.clone(), id);
}
export class CandlePart {
  constructor(mesh, geometry, bbox, id) {
    this.mesh = mesh;
    this.geometry = geometry;
    this.id = id;
    this.breakSide = 1;
    this.heatWicks = [];
    this.stress = 0;
    this.load = 0;
    this.sagMax = 0;
    this.cooldown = 0;
    this.fracture = null;
    this.originalTemplate = null;

    this.adoptGeometry(geometry, bbox, false);
    this.fillCold();
    this.computeSmoothNormals();
    this.originalTemplate = geometry.clone();
  }

  // Uebernimmt eine Geometrie (initial, nach einem Schnitt oder beim Reset)
  // und baut alle Simulationsdaten neu auf. Die aktuellen Positionen werden
  // dabei zur neuen Ruhelage; bereits geschmolzene Form bleibt also erhalten.
  adoptGeometry(geometry, bbox = null, disposeOld = false) {
    if (disposeOld && this.geometry && this.geometry !== geometry) {
      this.geometry.dispose();
    }

    this.geometry = geometry;
    this.mesh.geometry = geometry;
    this.count = geometry.attributes.position.count;

    if (!geometry.attributes.color) {
      const colors = new Float32Array(this.count * 3);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
    geometry.attributes.color.setUsage(THREE.DynamicDrawUsage);
    if (!bbox) {
      geometry.computeBoundingBox();
      bbox = geometry.boundingBox;
    }
    this.bbox = bbox.clone();

    const topology = buildMeshTopology(geometry);
    this.uniqueCount = topology.uniqueCount;
    this.uniqueOfVertex = topology.uniqueOfVertex;
    this.uniqueBase = topology.uniqueBase;
    this.uniquePos = new Float32Array(topology.uniqueBase);
    this.neighborStart = topology.neighborStart;
    this.neighborList = topology.neighborList;
    this.edgeA = topology.edgeA;
    this.edgeB = topology.edgeB;
    this.edgeRest = topology.edgeRest;

    this.uniqueTemps = new Float32Array(this.uniqueCount);
    this.uniqueSag = new Float32Array(this.uniqueCount);
    this.uniqueNormals = new Float32Array(this.uniqueCount * 3);
    this.uniqueColors = new Float32Array(this.uniqueCount * 3);
    this.tempScratch = new Float32Array(this.uniqueCount);
    this.sagScratch = new Float32Array(this.uniqueCount);

    const sourceColors = geometry.attributes.color.array;
    const seen = new Uint8Array(this.uniqueCount);
    for (let i = 0; i < this.count; i++) {
      const unique = this.uniqueOfVertex[i];
      if (seen[unique]) continue;
      seen[unique] = 1;
      this.uniqueColors[unique * 3] = sourceColors[i * 3];
      this.uniqueColors[unique * 3 + 1] = sourceColors[i * 3 + 1];
      this.uniqueColors[unique * 3 + 2] = sourceColors[i * 3 + 2];
    }

    this.rimCandidates = this.findRimCandidates();
    this.breakThreshold = CONFIG.shards.stressBase +
      (this.bbox.max.x - this.bbox.min.x) * CONFIG.shards.stressWidth;
    this.stress = 0;
    this.load = 0;
    this.sagMax = 0;
    this.cooldown = 0;
    this.fracture = null;
    this.computeSmoothNormals();
  }

  fillCold() {
    for (let i = 0; i < this.uniqueCount; i++) {
      this.uniqueColors[i * 3 + 0] = COLORS.waxCold[0];
      this.uniqueColors[i * 3 + 1] = COLORS.waxCold[1];
      this.uniqueColors[i * 3 + 2] = COLORS.waxCold[2];
    }
    this.scatterColors();
  }

  scatterColors() {
    const colors = this.geometry.attributes.color.array;
    for (let i = 0; i < this.count; i++) {
      const unique = this.uniqueOfVertex[i] * 3;
      const ix = i * 3;
      colors[ix] = this.uniqueColors[unique];
      colors[ix + 1] = this.uniqueColors[unique + 1];
      colors[ix + 2] = this.uniqueColors[unique + 2];
    }
    this.geometry.attributes.color.needsUpdate = true;
  }

  scatterPositions() {
    const positions = this.geometry.attributes.position.array;
    for (let i = 0; i < this.count; i++) {
      const unique = this.uniqueOfVertex[i] * 3;
      const ix = i * 3;
      positions[ix] = this.uniquePos[unique];
      positions[ix + 1] = this.uniquePos[unique + 1];
      positions[ix + 2] = this.uniquePos[unique + 2];
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  // Weiche Normalen aus den aktuellen Positionen. Weil die Topologie die
  // Kopien eines Punktes kennt, wird ueber Dreiecksgrenzen gemittelt.
  computeSmoothNormals() {
    if (!this.geometry.attributes.normal) {
      this.geometry.setAttribute(
        'normal',
        new THREE.BufferAttribute(new Float32Array(this.count * 3), 3),
      );
    }
    const positions = this.geometry.attributes.position.array;
    const normals = this.geometry.attributes.normal.array;
    const accum = new Float32Array(this.uniqueCount * 3);

    for (let i = 0; i < this.count; i += 3) {
      const ax = positions[i], ay = positions[i + 1], az = positions[i + 2];
      const bx = positions[i + 3], by = positions[i + 4], bz = positions[i + 5];
      const cx = positions[i + 6], cy = positions[i + 7], cz = positions[i + 8];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      for (let v = 0; v < 3; v++) {
        const unique = this.uniqueOfVertex[i + v] * 3;
        accum[unique] += nx;
        accum[unique + 1] += ny;
        accum[unique + 2] += nz;
      }
    }

    for (let u = 0; u < this.uniqueCount; u++) {
      const ix = u * 3;
      const length = Math.hypot(accum[ix], accum[ix + 1], accum[ix + 2]) || 1;
      accum[ix] /= length;
      accum[ix + 1] /= length;
      accum[ix + 2] /= length;
    }

    this.uniqueNormals.set(accum);
    for (let i = 0; i < this.count; i++) {
      const unique = this.uniqueOfVertex[i] * 3;
      const ix = i * 3;
      normals[ix] = accum[unique];
      normals[ix + 1] = accum[unique + 1];
      normals[ix + 2] = accum[unique + 2];
    }
    fixDegenerateNormals(normals, this.count);
    this.geometry.attributes.normal.needsUpdate = true;
  }

  // Kandidaten am oberen Rand: dort entstehen Tropfen und spaeter der Bruch.
  // Rueckgabe sind logische (verschweisste) Vertex-Indizes.
  findRimCandidates() {
    const positions = this.uniqueBase;
    const centerX = (this.bbox.min.x + this.bbox.max.x) / 2;
    const centerZ = (this.bbox.min.z + this.bbox.max.z) / 2;
    const halfX = Math.max(0.001, (this.bbox.max.x - this.bbox.min.x) / 2);
    const halfZ = Math.max(0.001, (this.bbox.max.z - this.bbox.min.z) / 2);
    const height = this.bbox.max.y - this.bbox.min.y;
    const band = Math.max(0.02, height * 0.24);
    const candidates = [];

    for (let u = 0; u < this.uniqueCount; u++) {
      const ix = u * 3;
      const x = positions[ix];
      const y = positions[ix + 1];
      const z = positions[ix + 2];
      if (y < this.bbox.max.y - band) continue;
      const edge = Math.max(
        Math.abs(x - centerX) / halfX,
        Math.abs(z - centerZ) / halfZ,
      );
      if (edge > 0.5) candidates.push(u);
    }
    return candidates.length ? candidates : [0];
  }

  // Aktuelle Oberflaechenhoehe nahe einer horizontalen Position. Der Docht
  // benutzt das, um mit dem schmelzenden Wachs nach unten zu wandern, statt
  // ueber der abgesackten Oberflaeche zu schweben.
  surfaceHeightNear(x, z) {
    const base = this.uniqueBase;
    const pos = this.uniquePos;
    const radiusSq = 0.09;
    let highest = -Infinity;
    let nearest = 0;
    let nearestSq = Infinity;
    for (let u = 0; u < this.uniqueCount; u++) {
      const ix = u * 3;
      const dx = base[ix] - x;
      const dz = base[ix + 2] - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestSq) {
        nearestSq = d2;
        nearest = pos[ix + 1];
      }
      if (d2 <= radiusSq && pos[ix + 1] > highest) highest = pos[ix + 1];
    }
    return highest > -Infinity ? highest : nearest;
  }

  update(dt) {
    const count = this.uniqueCount;
    if (!count) return;

    const positions = this.uniquePos;
    const base = this.uniqueBase;
    const normals = this.uniqueNormals;
    const temps = this.uniqueTemps;
    const sag = this.uniqueSag;
    const wicks = this.heatWicks.length ? this.heatWicks : state.wicks;
    const coreSq = CONFIG.heat.radius * CONFIG.heat.radius;
    const haloSq = CONFIG.heat.haloRadius * CONFIG.heat.haloRadius;
    const midY = (this.bbox.min.y + this.bbox.max.y) * 0.5;
    const bridgeHeat = CONFIG.shards.bridgeHeat;
    let hotCount = 0;
    let topMass = 0;

    // 1) Waerme: Kern um die Flamme + breiter Halo. Der Halo ist der
    //    Grund, warum nicht nur ein kleiner Punkt unter dem Docht schmilzt.
    for (let u = 0; u < count; u++) {
      const ix = u * 3;
      const bx = base[ix];
      const by = base[ix + 1];
      const bz = base[ix + 2];
      let core = 0;
      let halo = 0;

      for (const wick of wicks) {
        if (!wick.active) continue;
        const dx = bx - wick.localHeat.x;
        const dy = by - wick.localHeat.y;
        const dz = bz - wick.localHeat.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < coreSq) {
          const value = 1 - d2 / coreSq;
          if (value > core) core = value;
        }
        if (d2 < haloSq) {
          const value = 1 - d2 / haloSq;
          if (value > halo) halo = value;
        }
      }

      const target = Math.max(core * core, halo * halo * CONFIG.heat.haloStrength);
      let temp = temps[u];
      if (target > temp) temp += (target - temp) * CONFIG.heat.heatRate * dt;
      else temp -= temp * CONFIG.heat.coolRate * dt;
      temps[u] = clamp(temp, 0, 1);
    }

    // 2) Waermeleitung entlang der Mesh-Kanten. Hitze kriecht dadurch
    //    in die Nachbarschaft, auch ohne direkten Flammenabstand.
    this.tempScratch.set(temps);
    const diffusion = Math.min(0.55, CONFIG.heat.diffusion * dt);
    for (let u = 0; u < count; u++) {
      const start = this.neighborStart[u];
      const end = this.neighborStart[u + 1];
      if (end <= start) continue;
      let sum = 0;
      for (let n = start; n < end; n++) sum += this.tempScratch[this.neighborList[n]];
      const average = sum / (end - start);
      temps[u] = clamp(temps[u] + (average - temps[u]) * diffusion, 0, 1);
    }

    // 3) Schwerkraft und Farbe. Heisse Vertices werden schneller nach
    //    unten gezogen; die Nachbarschaft folgt ueber die Glaettung.
    for (let u = 0; u < count; u++) {
      const ix = u * 3;
      const temp = temps[u];
      if (temp > 0.56) hotCount++;

      const melt = smoothstep(CONFIG.heat.meltThreshold, 1, temp);
      const gravityBias = 0.62 + temp * 1.05;
      sag[u] = Math.min(
        CONFIG.heat.maxSag,
        sag[u] + melt * CONFIG.heat.sagRate * gravityBias * dt,
      );
      if (sag[u] > this.sagMax) this.sagMax = sag[u];

      if (base[ix + 1] > midY && temp > bridgeHeat) {
        topMass += temp - bridgeHeat;
      }

      const warmMix = smoothstep(0.07, 0.56, temp);
      const hotMix = smoothstep(0.56, 0.98, temp);
      const r = lerp(lerp(COLORS.waxCold[0], COLORS.waxWarm[0], warmMix), COLORS.waxHot[0], hotMix);
      const g = lerp(lerp(COLORS.waxCold[1], COLORS.waxWarm[1], warmMix), COLORS.waxHot[1], hotMix);
      const b = lerp(lerp(COLORS.waxCold[2], COLORS.waxWarm[2], warmMix), COLORS.waxHot[2], hotMix);
      this.uniqueColors[ix] = r;
      this.uniqueColors[ix + 1] = g;
      this.uniqueColors[ix + 2] = b;
    }

    // 4) Schmelzweg glaetten: Ein heisser Vertex zieht seine Nachbarn
    //    mit nach unten, statt einen einzelnen Stachel zu bilden.
    this.sagScratch.set(sag);
    const sagSpread = Math.min(0.4, CONFIG.heat.flow * dt);
    for (let u = 0; u < count; u++) {
      const heat = temps[u];
      if (heat < 0.18) continue;
      const start = this.neighborStart[u];
      const end = this.neighborStart[u + 1];
      if (end <= start) continue;
      let sum = 0;
      for (let n = start; n < end; n++) sum += this.sagScratch[this.neighborList[n]];
      const average = sum / (end - start);
      if (average > sag[u]) {
        sag[u] += (average - sag[u]) * sagSpread * smoothstep(0.18, 0.8, heat);
      }
    }

    // 5) Position aus Ruhelage + Schmelzweg + seitlicher Normale.
    for (let u = 0; u < count; u++) {
      const ix = u * 3;
      const drop = sag[u];
      positions[ix] = base[ix] + normals[ix] * drop * CONFIG.heat.normalFlow;
      positions[ix + 1] = Math.max(0.003, base[ix + 1] - drop);
      positions[ix + 2] = base[ix + 2] + normals[ix + 2] * drop * CONFIG.heat.normalFlow;
    }

    // 6) Necking: kurz vor dem Bruch zieht sich der Steg zusammen.
    //    Der Lappen haengt dann sichtbar an einer duennen Stelle.
    if (this.fracture) {
      const stressRatio = clamp(this.stress / Math.max(0.0001, this.breakThreshold), 0, 1);
      if (stressRatio > CONFIG.heat.neckStart) {
        const strength = smoothstep(CONFIG.heat.neckStart, 1, stressRatio) *
          CONFIG.heat.neckAmount;
        const plane = this.fracture;
        const band = 0.16;
        for (let u = 0; u < count; u++) {
          const ix = u * 3;
          const distance = plane.n.x * positions[ix] +
            plane.n.y * positions[ix + 1] +
            plane.n.z * positions[ix + 2] - plane.c;
          const falloff = Math.exp(-(distance * distance) / (band * band));
          const pinch = strength * falloff;
          if (pinch < 0.0005) continue;
          const scale = 1 - pinch;
          positions[ix] = plane.centerX + (positions[ix] - plane.centerX) * scale;
          positions[ix + 2] = plane.centerZ + (positions[ix + 2] - plane.centerZ) * scale;
        }
      }
    }

    // 7) Fluid-Relaxation: heisse Bereiche gleiten leicht uebereinander.
    //    Das nimmt den harten "Lego"-Eindruck aus der Oberflaeche.
    const flow = Math.min(0.12, CONFIG.heat.flow * dt);
    for (let u = 0; u < count; u++) {
      const weight = smoothstep(0.3, 0.9, temps[u]);
      if (weight <= 0) continue;
      const start = this.neighborStart[u];
      const end = this.neighborStart[u + 1];
      if (end <= start) continue;
      let sx = 0, sy = 0, sz = 0;
      for (let n = start; n < end; n++) {
        const v = this.neighborList[n] * 3;
        sx += positions[v];
        sy += positions[v + 1];
        sz += positions[v + 2];
      }
      const inverse = 1 / (end - start);
      const k = flow * weight;
      const ix = u * 3;
      positions[ix] = lerp(positions[ix], sx * inverse, k);
      positions[ix + 1] = lerp(positions[ix + 1], sy * inverse, k);
      positions[ix + 2] = lerp(positions[ix + 2], sz * inverse, k);
    }

    // 8) Abstandserhaltung: zu nah gekommene heisse Vertices stossen
    //    sich ab. So bleibt das Volumen sichtbar und der Mesh kollabiert
    //    nicht in eine duenne Flaeche.
    for (let pass = 0; pass < 2; pass++) {
      for (let e = 0; e < this.edgeA.length; e++) {
        const a = this.edgeA[e];
        const b = this.edgeB[e];
        const heat = (temps[a] + temps[b]) * 0.5;
        if (heat < 0.28) continue;
        const weight = smoothstep(0.28, 0.9, heat);
        const minDistance = Math.min(
          this.edgeRest[e] * 0.72,
          CONFIG.heat.minSpacing,
        );
        if (minDistance <= 1e-5) continue;

        const ia = a * 3;
        const ib = b * 3;
        let dx = positions[ib] - positions[ia];
        let dy = positions[ib + 1] - positions[ia + 1];
        let dz = positions[ib + 2] - positions[ia + 2];
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq >= minDistance * minDistance) continue;

        const distance = Math.sqrt(Math.max(1e-12, distanceSq));
        const inverse = 1 / distance;
        if (distanceSq < 1e-12) {
          dx = 1;
          dy = 0;
          dz = 0;
        } else {
          dx *= inverse;
          dy *= inverse;
          dz *= inverse;
        }
        const push = (minDistance - distance) * weight *
          CONFIG.heat.repulsion * 0.5;
        positions[ia] -= dx * push;
        positions[ia + 1] -= dy * push * 0.55;
        positions[ia + 2] -= dz * push;
        positions[ib] += dx * push;
        positions[ib + 1] += dy * push * 0.55;
        positions[ib + 2] += dz * push;
      }
    }

    // Der Tisch bleibt eine harte Untergrenze, auch nach der Relaxation.
    for (let u = 0; u < count; u++) {
      const iy = u * 3 + 1;
      if (positions[iy] < 0.003) positions[iy] = 0.003;
    }

    this.scatterPositions();
    this.scatterColors();

    // Weiche Normalen nur alle drei Frames; die Bewegung ist langsam
    // genug, dass dazwischen nichts hart wirkt.
    if (state.normalFrame % 3 === 0) this.computeSmoothNormals();

    // 9) Gewicht und Bruch. Nicht die reine Zeit, sondern die heisse
    //    Masse oberhalb der Mitte belastet den kleinen Steg.
    const wick = this.heatWicks[0];
    const burning = wick && wick.burn > 0.012;
    const load = topMass / count;
    this.load += (load - this.load) * Math.min(1, dt * 3);
    if (burning) {
      const hotFraction = hotCount / count;
      this.stress += (this.load * 6.4 + hotFraction * 0.65) * dt;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.fracture && this.stress > this.breakThreshold * CONFIG.heat.neckStart) {
      this.chooseFracturePlane();
    }
  }

  // Die Bruchebene wird einseitig schraeg gelegt. Dadurch bricht ein
  // Randstueck ab und nicht die komplette Buchstabenoberseite.
  chooseFracturePlane() {
    const count = this.uniqueCount;
    if (!count) return null;
    const side = this.breakSide;
    this.breakSide *= -1;

    const normal = new THREE.Vector3(0.55 * side, 1.0, rand(-0.22, 0.22)).normalize();
    const distances = new Float32Array(count);
    const centerX = (this.bbox.min.x + this.bbox.max.x) * 0.5;
    const centerY = (this.bbox.min.y + this.bbox.max.y) * 0.5;
    const centerZ = (this.bbox.min.z + this.bbox.max.z) * 0.5;

    for (let u = 0; u < count; u++) {
      const ix = u * 3;
      distances[u] = normal.x * this.uniquePos[ix] +
        normal.y * this.uniquePos[ix + 1] +
        normal.z * this.uniquePos[ix + 2];
    }

    const sorted = Array.from(distances).sort((a, b) => a - b);
    const target = clamp(
      0.14,
      CONFIG.shards.minChunkRatio + 0.02,
      CONFIG.shards.maxChunkRatio - 0.04,
    );
    let constant = sorted[Math.floor(sorted.length * (1 - target))];

    // Der positive Teil muss oben liegen; sonst lieber etwas höher
    // schneiden. Das verhindert einen Schnitt quer durch den Buchstabenfuss.
    const centerDistance = normal.x * centerX + normal.y * centerY + normal.z * centerZ;
    if (constant < centerDistance) constant = centerDistance + 0.04;

    let sx = 0;
    let sz = 0;
    let samples = 0;
    for (let u = 0; u < count; u++) {
      if (Math.abs(distances[u] - constant) > 0.16) continue;
      const ix = u * 3;
      sx += this.uniquePos[ix];
      sz += this.uniquePos[ix + 2];
      samples++;
    }
    if (samples === 0) {
      sx = centerX;
      sz = centerZ;
      samples = 1;
    }

    this.fracture = {
      n: normal,
      c: constant,
      centerX: sx / samples,
      centerZ: sz / samples,
    };
    return this.fracture;
  }

  canBreak() {
    if (this.cooldown > 0) return false;
    if (this.stress < this.breakThreshold) return false;
    if (this.sagMax < 0.04) return false;
    const wick = this.heatWicks[0];
    return Boolean(wick && wick.burn > 0.018);
  }

  // Vor dem eigentlichen Schnitt wird die Ebene an die inzwischen weiter
  // abgesackte Geometrie angepasst. Sonst kann der positive Teil durch das
  // Nachrutschen zu klein werden und der Bruch wuerde endlos verworfen.
  refineFractureConstant(plane) {
    const count = this.uniqueCount;
    if (!count) return;
    const distances = new Float32Array(count);
    for (let u = 0; u < count; u++) {
      const ix = u * 3;
      distances[u] = plane.n.x * this.uniquePos[ix] +
        plane.n.y * this.uniquePos[ix + 1] +
        plane.n.z * this.uniquePos[ix + 2];
    }
    const sorted = Array.from(distances).sort((a, b) => a - b);
    const target = clamp(
      0.15,
      CONFIG.shards.minChunkRatio + 0.05,
      CONFIG.shards.maxChunkRatio - 0.04,
    );
    plane.c = sorted[Math.floor(sorted.length * (1 - target))];

    let sx = 0;
    let sz = 0;
    let samples = 0;
    for (let u = 0; u < count; u++) {
      if (Math.abs(distances[u] - plane.c) > 0.16) continue;
      const ix = u * 3;
      sx += this.uniquePos[ix];
      sz += this.uniquePos[ix + 2];
      samples++;
    }
    if (samples > 0) {
      plane.centerX = sx / samples;
      plane.centerZ = sz / samples;
    }
  }

  // Echter Schnitt: Das Mesh wird in zwei geschlossene Teile geteilt.
  // Beide erhalten eine Deckflaeche; der abgetrennte Teil wird zum Shard.
  split() {
    if (!this.fracture) this.chooseFracturePlane();
    const plane = this.fracture;
    if (!plane) return null;
    this.refineFractureConstant(plane);

    const sliced = sliceGeometry(this.geometry, plane.n, plane.c);
    const positiveTriangles = sliced.positive.positions.length / 9;
    const negativeTriangles = sliced.negative.positions.length / 9;
    const totalTriangles = positiveTriangles + negativeTriangles;
    const ratio = totalTriangles > 0 ? positiveTriangles / totalTriangles : 0;

    if (
      positiveTriangles < 3 ||
      negativeTriangles < 4 ||
      ratio < CONFIG.shards.minChunkRatio ||
      ratio > CONFIG.shards.maxChunkRatio
    ) {
      this.cooldown = 1.2;
      this.stress *= 0.82;
      return null;
    }

    const positiveCap = buildSliceCaps(
      sliced.positive.segments,
      plane.n.clone().negate(),
    );
    const negativeCap = buildSliceCaps(sliced.negative.segments, plane.n);

    const mainGeometry = geometryFromArrays(
      sliced.negative.positions.concat(negativeCap.positions),
      sliced.negative.colors.concat(negativeCap.colors),
    );
    const chunkGeometry = geometryFromArrays(
      sliced.positive.positions.concat(positiveCap.positions),
      sliced.positive.colors.concat(positiveCap.colors),
    );
    if (!mainGeometry || !chunkGeometry) return null;

    this.mesh.updateMatrixWorld(true);
    chunkGeometry.computeBoundingBox();
    const center = chunkGeometry.boundingBox.getCenter(new THREE.Vector3());
    chunkGeometry.translate(-center.x, -center.y, -center.z);
    chunkGeometry.computeBoundingBox();
    chunkGeometry.computeBoundingSphere();
    smoothGeometryNormals(chunkGeometry);
    const volume = Math.max(1e-5, meshVolume(chunkGeometry));

    // Die aktuelle, bereits geschmolzene Form wird zur neuen Ruhelage
    // des Hauptteils. Frueher geschmolzenes Wachs springt nicht zurueck.
    this.adoptGeometry(mainGeometry, mainGeometry.boundingBox, true);
    this.computeSmoothNormals();
    this.reanchorWicks();

    this.cooldown = CONFIG.shards.cooldown;
    this.stress = 0;
    this.load = 0;
    this.sagMax = 0;
    this.fracture = null;

    const worldCenter = this.mesh.localToWorld(center.clone());
    return {
      geometry: chunkGeometry,
      center: worldCenter,
      radius: chunkGeometry.boundingSphere.radius,
      volume,
    };
  }

  // Nach einem Bruch sitzt der Docht auf der neuen, niedrigeren Oberflaeche.
  findTopAnchors(wanted) {
    const base = this.uniqueBase;
    const height = this.bbox.max.y - this.bbox.min.y;
    const band = Math.max(0.02, height * 0.11);
    const candidates = [];
    for (let u = 0; u < this.uniqueCount; u++) {
      if (base[u * 3 + 1] >= this.bbox.max.y - band) candidates.push(u);
    }
    if (!candidates.length) {
      return [new THREE.Vector3(
        (this.bbox.min.x + this.bbox.max.x) * 0.5,
        this.bbox.max.y,
        (this.bbox.min.z + this.bbox.max.z) * 0.5,
      )];
    }

    if (wanted === 1) {
      const previous = this.heatWicks[0] ? this.heatWicks[0].localBase : null;
      let best = candidates[0];
      let bestScore = Infinity;
      for (const u of candidates) {
        const ix = u * 3;
        const dx = previous ? base[ix] - previous.x : 0;
        const dz = previous ? base[ix + 2] - previous.z : 0;
        const score = (this.bbox.max.y - base[ix + 1]) * 1.4 + dx * dx + dz * dz;
        if (score < bestScore) {
          bestScore = score;
          best = u;
        }
      }
      return [new THREE.Vector3(base[best * 3], base[best * 3 + 1], base[best * 3 + 2])];
    }

    const anchors = [];
    for (let zone = 0; zone < wanted; zone++) {
      const minX = this.bbox.min.x + (this.bbox.max.x - this.bbox.min.x) * zone / wanted;
      const maxX = this.bbox.min.x + (this.bbox.max.x - this.bbox.min.x) * (zone + 1) / wanted;
      const zoneCenter = (minX + maxX) * 0.5;
      let best = null;
      let bestScore = Infinity;
      for (const u of candidates) {
        const ix = u * 3;
        const inZone = base[ix] >= minX && base[ix] <= maxX;
        const score = (inZone ? 0 : 4) + Math.abs(base[ix] - zoneCenter) +
          (this.bbox.max.y - base[ix + 1]) * 2;
        if (score < bestScore) {
          bestScore = score;
          best = u;
        }
      }
      if (best === null) best = candidates[0];
      anchors.push(new THREE.Vector3(base[best * 3], base[best * 3 + 1], base[best * 3 + 2]));
    }
    return anchors;
  }

  reanchorWicks() {
    if (!this.heatWicks.length) return;
    const anchors = this.findTopAnchors(this.heatWicks.length);
    this.heatWicks.forEach((wick, index) => {
      wick.setAnchor(anchors[index] || anchors[0]);
    });
  }

  reset() {
    if (this.originalTemplate) {
      const template = this.originalTemplate.clone();
      template.computeBoundingBox();
      this.adoptGeometry(template, template.boundingBox, true);
    }
    this.fillCold();
    this.computeSmoothNormals();
    this.reanchorWicks();
    this.stress = 0;
    this.load = 0;
    this.sagMax = 0;
    this.cooldown = 0;
    this.breakSide = 1;
    this.fracture = null;
  }
}
