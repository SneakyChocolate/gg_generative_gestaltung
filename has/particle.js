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
		this.maxspeeds = new Array(size);
		this.previousPositions = new Array(size);

		for (let i = 0; i < this.length; i ++) {
			this.positions[i] = rainSpawnPosition();
			this.velocities[i] = createVector(0, 0);
			this.accelerations[i] = createVector(0, 0);
			this.maxspeeds[i] = 0.2;
			this.previousPositions[i] = this.positions[i].copy();
		}
	}

	push() {
		const position = rainSpawnPosition();
		const velocitie = createVector(0, 0);
		const acceleration = createVector(0, 0);
		const maxspeed = 0.2;
		const previousPosition = position.copy();

		this.positions.push(position);
		this.velocities.push(velocitie);
		this.accelerations.push(acceleration);
		this.maxspeeds.push(maxspeed);
		this.previousPositions.push(previousPosition);

		this.length += 1;
	}

	update(flowfield, chunks) {
		this.handleFlowfield(flowfield);
		chunks.iterGroups((chunk) => {
			this.handleCollision(chunk);
		});
		this.move();
		this.edges();
	}

	move() {
		for (let i = 0; i < this.length; i ++) {
			this.velocities[i].add(this.accelerations[i]);
			this.velocities[i].limit(this.maxspeeds[i]);
			this.positions[i].add(this.velocities[i]);
			this.accelerations[i].mult(0);
		}
	}

	handleFlowfield(vectors) {
		for (let i = 0; i < this.length; i ++) {
			var x = floor(this.positions[i].x / scl);
			var y = floor(this.positions[i].y / scl);
			var index = x + y * cols;
			var force = vectors[index];
			this.applyForce(i, force);
		}
	}

	handleCollision(chunk) {
		iter2(chunk.length, (ai,bi) => {
			let [a,b] = [chunk[ai], chunk[bi]];
			const difference = this.positions[a].copy();
			difference.sub(this.positions[b]);
			const square_distance = difference.x * difference.x + difference.y * difference.y;
			if (square_distance < 3*3) {
				const addedAcceleration = difference.copy();
				addedAcceleration.x = 1 / addedAcceleration.x / 10;
				addedAcceleration.y = 1 / addedAcceleration.y / 10;

				this.accelerations[a].add(addedAcceleration);
				this.accelerations[b].sub(addedAcceleration);
			}
		});
	}

	applyForce(i, force) {
		this.accelerations[i].add(force);
	}

	show(pg) {
		pg.stroke(0,0,150,30);
		pg.strokeWeight(3);
		for (let i = 0; i < this.length; i ++) {
			pg.line(this.positions[i].x, this.positions[i].y, this.previousPositions[i].x, this.previousPositions[i].y);
			this.updatePrev(i);
		}
	}

	updatePrev(i) {
		this.previousPositions[i].x = this.positions[i].x;
		this.previousPositions[i].y = this.positions[i].y;
	}

	respawn(i) {
		this.positions[i] = rainSpawnPosition();
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

