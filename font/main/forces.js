// Jede Kraft ist ein System: läuft über alle Partikel und addiert auf acceleration.

function springHomeSystem() {
	for (let particle = 0; particle < particleCount(); particle++) {
		const towardsHome = p5.Vector.sub(home[particle], position[particle]);
		acceleration[particle].add(towardsHome.mult(SPRING_STRENGTH));
	}
}

function dragSystem() {
	for (let particle = 0; particle < particleCount(); particle++) {
		const againstMovement = p5.Vector.mult(velocity[particle], -DRAG_STRENGTH);
		acceleration[particle].add(againstMovement);
	}
}

function gravitySystem() {
	for (let particle = 0; particle < particleCount(); particle++) {
		acceleration[particle].y += GRAVITY_STRENGTH;
	}
}

function mouseRepelSystem() {
	const mouse = createVector(mouseX, mouseY);
	for (let particle = 0; particle < particleCount(); particle++) {
		const awayFromMouse = p5.Vector.sub(position[particle], mouse);
		acceleration[particle].add(mouseForce(awayFromMouse));
	}
}

function mouseForce(awayFromMouse) {
	const distance = awayFromMouse.mag();
	const isOutOfReach = distance >= MOUSE_RADIUS;
	const isExactlyOnMouse = distance === 0;
	if (isOutOfReach || isExactlyOnMouse) return createVector(0, 0);

	const closeness = 1 - distance / MOUSE_RADIUS;
	return awayFromMouse.setMag(MOUSE_STRENGTH * closeness);
}
