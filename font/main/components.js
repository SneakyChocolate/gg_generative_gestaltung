// Ein Partikel ist nur ein Index. Am gleichen Index in allen Arrays liegen seine Daten.
const home = [];
const position = [];
const velocity = [];
const acceleration = [];

function particleCount() {
	return position.length;
}

function createParticle(spot) {
	home.push(spot.copy());
	position.push(spot.copy());
	velocity.push(createVector(0, 0));
	acceleration.push(createVector(0, 0));
}

function removeAllParticles() {
	for (const component of [home, position, velocity, acceleration]) {
		component.length = 0;
	}
}

function createWordParticles() {
	removeAllParticles();
	wordToPoints(WORD).forEach(createParticle);
}
