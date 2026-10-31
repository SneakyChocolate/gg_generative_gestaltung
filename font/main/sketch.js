function setup() {
	createCanvas(windowWidth, windowHeight);
	pixelDensity(1);
	createWord();
}

function draw() {
	background(BACKGROUND_COLOR);
	springHomeSystem();
	dragSystem();
	gravitySystem();
	mouseRepelSystem();
	integrateSystem();
	renderSystem();
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
	createWord();
}
