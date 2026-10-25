// JK TODO s
// particle fluid simulation optimizations

function setup() {
	background("white");
	noiseSeed(0);
	createCanvas(realwidth, realheight);
	pixelDensity(1);

	// spatial chunking for improving the performance of particle collisions (fluid simulation for rain creating lakes)
	const chunksize = 40;
	chunks = new GridChunks(chunksize, chunksize, (position) => {
		return [
			Math.floor(position.x / width * chunksize),
			Math.floor(position.y / height * chunksize)
		];
	});
	worldmap_setup();
	particle_setup();
}

function update() {
	chunks.update(particles.positions);
	particles.update(flowfield, chunks);
	if (particles.length < 5000) {
		for (let i = 0; i < 5; i ++) {
			particles.push();
		}
	}
}

function draw() {
	// seperate drawing from calculations
	update();

	// use offscreen graphics for scaled rendering
	let pg = createGraphics(width, height);

	// this part below is for drawing
	pg.image(world_texture,0,0);

	// draw particles in between ground and clouds
	particles.show(pg);

	// clouds
	pg.image(sky_texture,0,0);

	image(pg, 0, 0, realwidth, realheight);

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

