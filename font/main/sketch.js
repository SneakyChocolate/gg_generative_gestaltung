function setup() {
	createCanvas(windowWidth, windowHeight);
	pixelDensity(1);
	createWordParticles();
}

function draw() {
	background(BACKGROUND_COLOR);
	springHomeSystem();
	dragSystem();
	gravitySystem();
	mouseRepelSystem();
	integrateSystem();
	renderSystem();
	renderDebug();
}

function keyPressed() {
	if (key === "d") toggleDebug();
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
	createWordParticles();
}
