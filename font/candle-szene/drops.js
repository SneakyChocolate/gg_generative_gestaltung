import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import * as CONFIG from "./config.js";
import { waxColor } from "./heat.js";

const ballColor = new THREE.Color();

export function mergeDrops(a, b) {
  const massA = a.radius ** 3;
  const massB = b.radius ** 3;
  const mass = massA + massB;
  const bigger = massA >= massB ? a : b;
  return {
    radius: Math.cbrt(mass),
    position: new THREE.Vector3().addScaledVector(a.position, massA).addScaledVector(b.position, massB).divideScalar(mass),
    velocity: new THREE.Vector3().addScaledVector(a.velocity, massA).addScaledVector(b.velocity, massB).divideScalar(mass),
    temperature: (a.temperature * massA + b.temperature * massB) / mass,
    sliding: bigger.sliding,
    floor: bigger.floor,
    body: null,
  };
}

export function createDropSystem(scene, physics, letters) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
  const pools = letters.map((letter) => createPool(scene, letter, material));
  return {
    update(dt, burnDt) {
      for (const pool of pools) {
        spawnDrop(pool, burnDt);
        moveDrops(pool, physics, burnDt);
        mergeTouching(pool, physics);
        for (const drop of pool.drops) drop.temperature = Math.max(0, drop.temperature - burnDt / CONFIG.COOL_SECONDS);
        if (needsRender(pool, physics)) render(pool, physics);
      }
    },
  };
}

function createPool(scene, letter, material) {
  const { box } = letter;
  const halfSize = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) / 2 + CONFIG.POOL_MARGIN;
  const field = new MarchingCubes(CONFIG.MC_RESOLUTION, material, false, true, 20000);
  field.position.set((box.min.x + box.max.x) / 2, CONFIG.TABLE_Y - CONFIG.POOL_MARGIN / 2 + halfSize, 0);
  field.scale.setScalar(halfSize);
  scene.add(field);
  return { letter, field, halfSize, drops: [], spawnTimer: 0 };
}

function spawnDrop(pool, burnDt) {
  pool.spawnTimer -= burnDt;
  if (!pool.letter.burning || pool.spawnTimer > 0 || pool.drops.length >= CONFIG.MAX_DROPS_PER_LETTER) return;
  pool.spawnTimer = CONFIG.DROP_INTERVAL * (0.5 + Math.random());
  const vertex = findMeltingVertex(pool.letter);
  if (vertex < 0) return;
  const geometry = pool.letter.mesh.geometry;
  const radius = THREE.MathUtils.randFloat(CONFIG.DROP_MIN_R, CONFIG.DROP_MAX_R);
  const normal = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("normal"), vertex);
  pool.drops.push({
    radius,
    position: new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("position"), vertex).addScaledVector(normal, radius * 0.5),
    velocity: new THREE.Vector3(),
    temperature: pool.letter.temperatures[vertex],
    sliding: true,
    floor: pool.letter.floors[vertex],
    body: null,
  });
}

function findMeltingVertex(letter) {
  const normals = letter.mesh.geometry.getAttribute("normal");
  for (let attempt = 0; attempt < 30; attempt++) {
    const vertex = Math.floor(Math.random() * letter.temperatures.length);
    const temperature = letter.temperatures[vertex];
    const facesCamera = normals.getZ(vertex) > 0.7;
    if (facesCamera && temperature > CONFIG.DROP_MIN_TEMPERATURE && temperature < CONFIG.DROP_MAX_TEMPERATURE) return vertex;
  }
  return -1;
}

function moveDrops(pool, physics, burnDt) {
  for (const drop of pool.drops) {
    if (drop.sliding) {
      drop.position.y -= CONFIG.SLIDE_SPEED * burnDt;
      if (drop.position.y - drop.radius <= drop.floor) {
        drop.sliding = false;
        drop.body = physics.addDrop(drop.position, drop.radius, new THREE.Vector3(0, -CONFIG.SLIDE_SPEED, 0));
      }
    } else {
      drop.position.copy(physics.position(drop.body));
      drop.velocity.copy(physics.velocity(drop.body));
    }
  }
}

function mergeTouching(pool, physics) {
  const drops = pool.drops;
  for (let i = 0; i < drops.length; i++) {
    for (let j = i + 1; j < drops.length; j++) {
      const a = drops[i];
      const b = drops[j];
      if (a.position.distanceTo(b.position) >= a.radius + b.radius) continue;
      const merged = mergeDrops(a, b);
      if (a.body) physics.remove(a.body);
      if (b.body) physics.remove(b.body);
      if (!merged.sliding) merged.body = physics.addDrop(merged.position, merged.radius, merged.velocity);
      drops[i] = merged;
      drops.splice(j, 1);
      j = i;
    }
  }
}

function isActive(pool, physics) {
  return pool.drops.some((drop) => drop.sliding || drop.temperature > 0 || !physics.isResting(drop.body));
}

function needsRender(pool, physics) {
  return isActive(pool, physics) || !pool.settledRendered;
}

function render(pool, physics) {
  const { field, halfSize } = pool;
  const boxSize = 2 * halfSize;
  field.reset();
  for (const drop of pool.drops) {
    const resting = !drop.sliding && drop.position.y - drop.radius <= CONFIG.TABLE_Y + 0.01;
    const radius = resting ? drop.radius * CONFIG.PUDDLE_SPREAD : drop.radius;
    const y = resting ? CONFIG.TABLE_Y - radius * CONFIG.PUDDLE_SINK : drop.position.y;
    const normalizedRadius = radius / boxSize;
    field.addBall(
      (drop.position.x - field.position.x) / boxSize + 0.5,
      (y - field.position.y) / boxSize + 0.5,
      (drop.position.z - field.position.z) / boxSize + 0.5,
      normalizedRadius * normalizedRadius * (field.isolation + CONFIG.MC_SUBTRACT),
      CONFIG.MC_SUBTRACT,
      waxColor(drop.temperature, ballColor),
    );
  }
  field.update();
  pool.settledRendered = !isActive(pool, physics);
}
