// JK TODO s
// particle fluid simulation optimizations

function setup() {
	// spatial chunking for improving the performance of particle collisions (fluid simulation for rain creating lakes)
	chunks = new GridChunks(100, 100, (position) => {
		return [
			Math.floor(position.x / width * 100),
			Math.floor(position.y / height * 100)
		];
	});
	worldmap_setup();
	particle_setup();
}

function update() {
	chunks.update(particles.positions);
	particles.update(flowfield, chunks);
	for (let i = 0; i < 20; i ++) {
		particles.push();
	}
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

