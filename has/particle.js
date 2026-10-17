// Daniel Shiffman
// http://codingtra.in
// http://patreon.com/codingtrain
// Code for: https://youtu.be/BjoM9oKOAKY

class Particles {
	constructor(size) {
		this.length = size;
		this.generations = new Array(size);
		this.positions = new Array(size);
		this.velocities = new Array(size);
		this.accelerations = new Array(size);
		this.maxspeed = new Array(size);
		this.previousPosition = new Array(size);

		for (let i = 0; i < this.length; i ++) {
			this.positions[i] = createVector(random(width), random(height));
			this.velocities[i] = createVector(0, 0);
			this.accelerations[i] = createVector(0, 0);
			this.maxspeed[i] = 0.2;
			this.previousPosition[i] = this.positions[i].copy();
		}
	}

	update(flowfield) {
		this.follow(flowfield);
		this.move();
		this.edges();
	}

	move() {
		for (let i = 0; i < this.length; i ++) {
			this.velocities[i].add(this.accelerations[i]);
			this.velocities[i].limit(this.maxspeed[i]);
			this.positions[i].add(this.velocities[i]);
			this.accelerations[i].mult(0);
		}
	}

	follow(vectors) {
		for (let i = 0; i < this.length; i ++) {
			var x = floor(this.positions[i].x / scl);
			var y = floor(this.positions[i].y / scl);
			var index = x + y * cols;
			var force = vectors[index];
			this.applyForce(i, force);
		}
	}

	applyForce(i, force) {
		this.accelerations[i].add(force);
	}

	show() {
		stroke(0,0,255);
		strokeWeight(1.5);
		for (let i = 0; i < this.length; i ++) {
			line(this.positions[i].x, this.positions[i].y, this.previousPosition[i].x, this.previousPosition[i].y);
			this.updatePrev(i);
		}
	}

	updatePrev(i) {
		this.previousPosition[i].x = this.positions[i].x;
		this.previousPosition[i].y = this.positions[i].y;
	}

	respawn(i) {
		this.positions[i] = createVector(random(width), random(height));
		this.velocities[i] = createVector(0, 0);
		this.accelerations[i] = createVector(0, 0);
	}
	edges() {
		for (let i = 0; i < this.length; i ++) {
			if (this.positions[i].x > width) {
				this.respawn(i);
				this.updatePrev(i);
			}
			if (this.positions[i].x < 0) {
				this.respawn(i);
				this.updatePrev(i);
			}
			if (this.positions[i].y > height) {
				this.respawn(i);
				this.updatePrev(i);
			}
			if (this.positions[i].y < 0) {
				this.respawn(i);
				this.updatePrev(i);
			}
		}
	}
}

