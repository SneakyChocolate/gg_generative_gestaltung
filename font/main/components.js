// Entity = Index. Komponenten = Arrays, am gleichen Index gehören sie zum gleichen Partikel.
const home = [];
const position = [];
const velocity = [];
const acceleration = [];

function createParticle(spot) {
	home.push(spot.copy());
	position.push(spot.copy());
	velocity.push(createVector(0, 0));
	acceleration.push(createVector(0, 0));
}

function createWord() {
	for (const array of [home, position, velocity, acceleration]) array.length = 0;
	wordToPoints(WORD, STEP).forEach(createParticle);
}
