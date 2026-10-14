// JK TODO s
// ecs for particles
// world map as flowfield
// particle fluid simulation
// slower particles

// JK FIXME s
// world noise assignment

function setup() {
	particle_setup();
	worldmap_setup();
}

function update() {
	// var yoff = 0;
	// for (var y = 0; y < rows; y++) {
	// 	var xoff = 0;
	// 	for (var x = 0; x < cols; x++) {
	// 		var index = x + y * cols;
	// 		var angle = noise(xoff, yoff, zoff) * TWO_PI * 4;
	// 		var v = p5.Vector.fromAngle(angle);
	// 		v.setMag(1);
	// 		flowfield[index] = v;
	// 		xoff += inc;
	// 		stroke(0, 50);
	// 	}
	// 	yoff += inc;

	// 	zoff += 0.0003;
	// }

	for (var i = 0; i < particles.length; i++) {
		particles[i].follow(flowfield);
		particles[i].update();
		particles[i].edges();
	}
}

function draw() {
	// seperate drawing from calculations
	update();

	// this part below is for drawing
	image(world_texture,0,0);

	// draw particles in between ground and clouds
	for (var i = 0; i < particles.length; i++) {
		particles[i].show();
	}

	// clouds
	image(cloud_texture,0,0);
	image(shadow_texture,0,0);
}

// function windowResized() {
// 	resizeCanvas(windowWidth, windowHeight);
// }

