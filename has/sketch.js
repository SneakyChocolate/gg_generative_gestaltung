// JK TODO s
// particle fluid simulation optimizations

function setup() {
	chunks = new GridChunks(20, 20, (position) => {
		return [
			Math.floor(position.x / width * 20),
			Math.floor(position.y / height * 20)
		];
	});
	worldmap_setup();
	particle_setup();
}

function update() {
	chunks.update(particles.positions);
	particles.update(flowfield, chunks);
	particles.push();
}

function draw() {
	// seperate drawing from calculations
	update();

	// this part below is for drawing
	image(world_texture,0,0);

	// draw particles in between ground and clouds
	particles.show();

	// clouds
	image(sky_texture,0,0);

	if (showChunks) drawChunks();
	if (showDebug) drawDebug();
}

function keyPressed() {
	if (key === 'd') showDebug = !showDebug;
	if (key === 'c') showChunks = !showChunks;
}

// function windowResized() {
// 	resizeCanvas(windowWidth, windowHeight);
// }

