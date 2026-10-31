function integrateSystem() {
	for (let particle = 0; particle < particleCount(); particle++) {
		velocity[particle].add(acceleration[particle]);
		position[particle].add(velocity[particle]);
		acceleration[particle].mult(0);
	}
}

function renderSystem() {
	noStroke();
	fill(PARTICLE_COLOR);
	for (const spot of position) {
		circle(spot.x, spot.y, PARTICLE_SIZE);
	}
}
