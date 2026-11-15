// Daniel Shiffman
// http://codingtra.in
// https://youtu.be/CKeyIbT3vXI

class Firework {
  constructor() {
    this.hu = random(255);
    this.firework = new Particle(random(width), height, this.hu, true);
    this.exploded = false;
    this.particles = [];
    this.smoke = [];
  }

  done() {
    if (this.exploded && this.particles.length === 0 && this.smoke.length === 0) {
      return true;
    } else {
      return false;
    }
  }

  update() {
    if (!this.exploded) {
      this.firework.applyForce(gravity);
      this.firework.update();
      this.smoke.push(new Smoke(this.firework.pos.x, this.firework.pos.y));

      if (this.firework.vel.y >= 0) {
        this.exploded = true;
        this.explode();
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      curl2D(flow, p.pos.x, p.pos.y, flowForce);
      p.applyForce(gravity);
      p.applyForce(flowForce.mult(FLOW_STRENGTH));
      p.update();

      if (random(1) < SMOKE_CHANCE) {
        this.smoke.push(new Smoke(p.pos.x, p.pos.y));
      }

      if (this.particles[i].done()) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.smoke.length - 1; i >= 0; i--) {
      this.smoke[i].update();

      if (this.smoke[i].done()) {
        this.smoke.splice(i, 1);
      }
    }
  }

  explode() {
    for (let i = 0; i < 100; i++) {
      const p = new Particle(this.firework.pos.x, this.firework.pos.y, this.hu, false);
      this.particles.push(p);
    }
  }

  show() {
    for (let i = 0; i < this.smoke.length; i++) {
      this.smoke[i].show();
    }

    if (!this.exploded) {
      this.firework.show();
    }

    for (var i = 0; i < this.particles.length; i++) {
      this.particles[i].show();
    }
  }
}
