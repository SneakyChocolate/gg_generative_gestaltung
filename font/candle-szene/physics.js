import * as CONFIG from "./config.js";

export function stepFall(body, dt, groundY) {
  if (body.resting) return;
  // PHYSICS: semi-impliziter Euler, erst Geschwindigkeit, dann Position, Landen auf groundY
  body.velocity.y += CONFIG.GRAVITY * dt;
  body.position.addScaledVector(body.velocity, dt);
  if (body.position.y - body.radius <= groundY) {
    body.position.y = groundY + body.radius;
    body.velocity.set(0, 0, 0);
    body.resting = true;
  }
}
