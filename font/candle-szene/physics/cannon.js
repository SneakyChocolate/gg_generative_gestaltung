import * as CANNON from "cannon-es";
import * as THREE from "three";

export function createPhysics({ gravity, tableY }) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, gravity, 0) });
  world.defaultContactMaterial.restitution = 0;
  world.defaultContactMaterial.friction = 0.9;
  const table = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  table.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  table.position.y = tableY;
  world.addBody(table);
  const meshes = new Map();

  return {
    addDrop(position, radius, velocity) {
      const body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(radius), linearDamping: 0.6, angularDamping: 0.99 });
      body.position.set(position.x, position.y, position.z);
      body.velocity.set(velocity.x, velocity.y, velocity.z);
      world.addBody(body);
      return body;
    },
    addChunk(mesh) {
      mesh.geometry.computeBoundingBox();
      const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
      const body = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)) });
      body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
      body.velocity.set(THREE.MathUtils.randFloatSpread(0.6), 0.4, THREE.MathUtils.randFloat(0.3, 0.6));
      body.angularVelocity.set(THREE.MathUtils.randFloatSpread(6), THREE.MathUtils.randFloatSpread(6), THREE.MathUtils.randFloatSpread(6));
      world.addBody(body);
      meshes.set(body, mesh);
      return body;
    },
    remove(body) {
      world.removeBody(body);
      meshes.delete(body);
    },
    step(dt) {
      world.step(1 / 60, dt, 3);
      for (const [body, mesh] of meshes) {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
      }
    },
    position: (body) => body.position,
    velocity: (body) => body.velocity,
    isResting: (body) => body.position.y - body.boundingRadius <= tableY + 0.01 && body.velocity.lengthSquared() < 0.01,
  };
}
