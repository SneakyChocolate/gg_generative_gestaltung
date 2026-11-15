class Smoke {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.2, 1));
    this.lifespan = 160;
    this.size = random(6, 12);
    this.grey = random(110, 190);
  }

  update() {
    curl2D(flow, this.pos.x, this.pos.y, flowForce);
    this.vel.add(flowForce.mult(SMOKE_FLOW_STRENGTH));
    this.vel.y -= SMOKE_RISE;
    this.vel.mult(0.95);
    this.pos.add(this.vel);
    this.size += 0.15;
    this.lifespan -= 2;
  }

  done() {
    return this.lifespan < 0;
  }

  show() {
    colorMode(RGB);
    noStroke();
    fill(this.grey, this.grey, this.grey, this.lifespan * 0.05);
    circle(this.pos.x, this.pos.y, this.size);
  }
}
