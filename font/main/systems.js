function integrateSystem() {
	for (let e = 0; e < position.length; e++) {
		velocity[e].add(acceleration[e]);
		position[e].add(velocity[e]);
		acceleration[e].mult(0);
	}
}

function renderSystem() {
	noStroke();
	fill(PARTICLE_COLOR);
	for (const p of position) circle(p.x, p.y, PARTICLE_SIZE);
}
