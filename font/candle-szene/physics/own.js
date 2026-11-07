import * as THREE from "three";

const settleBox = new THREE.Box3();

function settleOnTable(body, tableY) {
  settleBox.setFromObject(body.mesh);
  body.position.y += tableY - settleBox.min.y;
  body.mesh.position.copy(body.position);
}

export function createPhysics({ gravity, tableY }) {
  const bodies = new Set();

  function add(position, radius, velocity, mesh = null, spin = null) {
    const body = { position: position.clone(), velocity: velocity.clone(), radius, mesh, spin, resting: false };
    bodies.add(body);
    return body;
  }

  return {
    addDrop: (position, radius, velocity) => add(position, radius, velocity),
    addChunk(mesh) {
      mesh.geometry.computeBoundingSphere();
      const velocity = new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.6), 0.4, THREE.MathUtils.randFloat(0.3, 0.6));
      const spin = new THREE.Vector3().randomDirection().multiplyScalar(4);
      return add(mesh.position, mesh.geometry.boundingSphere.radius * 0.5, velocity, mesh, spin);
    },
    remove: (body) => bodies.delete(body),
    step(dt) {
      for (const body of bodies) {
        if (body.resting) continue;
        body.velocity.y += gravity * dt;
        body.position.addScaledVector(body.velocity, dt);
        if (body.position.y - body.radius <= tableY) {
          body.position.y = tableY + body.radius;
          body.velocity.set(0, 0, 0);
          body.resting = true;
        }
        if (body.mesh) {
          body.mesh.position.copy(body.position);
          body.mesh.rotation.x += body.spin.x * dt;
          body.mesh.rotation.y += body.spin.y * dt;
          body.mesh.rotation.z += body.spin.z * dt;
          if (body.resting) settleOnTable(body, tableY);
        }
      }
    },
    position: (body) => body.position,
    velocity: (body) => body.velocity,
    isResting: (body) => body.resting,
  };
}
