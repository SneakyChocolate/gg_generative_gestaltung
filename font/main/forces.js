// Jede Kraft ist ein System: läuft über alle Partikel und addiert auf acceleration.

function springHomeSystem() {
	for (let e = 0; e < position.length; e++) {
		acceleration[e].add(p5.Vector.sub(home[e], position[e]).mult(SPRING));
	}
}

function dragSystem() {
	for (let e = 0; e < position.length; e++) {
		acceleration[e].add(p5.Vector.mult(velocity[e], -DRAG));
	}
}

function gravitySystem() {
	for (let e = 0; e < position.length; e++) {
		acceleration[e].y += GRAVITY;
	}
}

// Maus schiebt weg, nahe Partikel stärker (linear bis 0 am Rand)
function mouseRepelSystem() {
	const mouse = createVector(mouseX, mouseY);
	for (let e = 0; e < position.length; e++) {
		const away = p5.Vector.sub(position[e], mouse);
		const distance = away.mag();

		const outOfReach = distance >= MOUSE_RADIUS;
		const onCursor = distance === 0;
		if (outOfReach || onCursor) continue;

		const closeness = 1 - distance / MOUSE_RADIUS;
		acceleration[e].add(away.setMag(MOUSE_FORCE * closeness));
	}
}
