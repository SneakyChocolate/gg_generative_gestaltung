
function setup() {
	particle_setup();
	worldmap_setup();
}

function update() {
	var yoff = 0;
	for (var y = 0; y < rows; y++) {
		var xoff = 0;
		for (var x = 0; x < cols; x++) {
			var index = x + y * cols;
			var angle = noise(xoff, yoff, zoff) * TWO_PI * 4;
			var v = p5.Vector.fromAngle(angle);
			v.setMag(1);
			flowfield[index] = v;
			xoff += inc;
			stroke(0, 50);
		}
		yoff += inc;

		zoff += 0.0003;
	}

	for (var i = 0; i < particles.length; i++) {
		particles[i].follow(flowfield);
		particles[i].update();
		particles[i].edges();
	}
}

function draw() {
	update();

	image(world_texture,0,0);
	for (var i = 0; i < particles.length; i++) {
		particles[i].show();
	}

	image(cloud_texture,0,0);
	image(shadow_texture,0,0);
}

// function windowResized() {
// 	resizeCanvas(windowWidth, windowHeight);
// }

