const width = 500
const height = 500

var inc = 0.1;
var scl = 10;
var cols, rows;

var zoff = 0;

var particles = [];

var flowfield;

// this function is used to replicate world map color similar to minecraft based on height 0 to 1
function hardenWorldMapRgba(height) {
	// deep water
	if (height < 0.2) {
		return [0,0,255,255];
	}
	// flat water
	if (height < 0.3) {
		return [100,100,255,255];
	}
	// dirt
	if (height < 0.4) {
		return [155,52,0,255];
	}
	// grass
	if (height < 0.5) {
		return [50,200,20,255];
	}
	// stone
	if (height < 0.6) {
		return [100,100,100,255];
	}
	// snowy stone
	if (height < 0.7) {
		return [150,150,150,255];
	}
	// snow
	return [255,255,255,255];
}

// same as harden world map but just soft edges via lerp
function lerpWorldMapRgba(height) {
	let layers = [
		[0.1,0,0,100,255],
		[0.3,0,0,255,255],
		[0.35,200,200,100,255],
		[0.4,20,100,20,255],
		[0.6,50,150,20,255],
		[0.65,50,50,50,255],
		[0.7,100,100,100,255],
		[0.9,150,150,150,255],
		[0.91,255,255,255,255],
		[1,255,255,255,255]
	];
	for (let i = 0; i < layers.length; i ++) {
		let [until,r,g,b,a] = layers[i];
		if (until >= height) {
			if (i == 0) return [r,g,b,a];
			let [pu, pr, pg, pb, pa] = layers[i-1];
			let du = until - pu;
			let percent = (height - pu) / du;
			return [
				lerp(pr, r, percent),
				lerp(pg, g, percent),
				lerp(pb, b, percent),
				lerp(pa, a, percent),
			];
		}
	}
}

/// this function is used to create an off screen image texture based on noise.
/// fn(num,num) [num;2], fn(number) [number;4]
function noiseTexture(offset_fn, rgba_fn) {
	const tex = createImage(width, height);
	tex.loadPixels();
	for (let x = 0; x < width; x++) {
		for (let y = 0; y < height; y++) {
			let index = (x + y * width) * 4;
			// A Perlin noise brightness!
			let [ox,oy] = offset_fn(x, y);
			let bright = map(noise(ox, oy), 0, 1, 0, 255);
			let [r,g,b,a] = rgba_fn(bright);
			tex.pixels[index] = r;
			tex.pixels[index + 1] = g;
			tex.pixels[index + 2] = b;
			tex.pixels[index + 3] = a;
		}
	}
	tex.updatePixels();
	return tex;
}

const clouds_count = 140;
function cloudAlpha(b) {
	return constrain((b - clouds_count) * 3, 0, 255);
}

var world_texture;
var cloud_texture;
var shadow_texture;
function worldmap_setup() {
	background("white");
	noiseSeed(0);
	createCanvas(width, height);
	pixelDensity(1);
	print(`Canvas size is ${width}x${height}`);

	// world map
	world_texture = noiseTexture(
		(x,y) => [x / 20 + 0, y / 20 + 0],
		(b) => lerpWorldMapRgba(b/255))
	;
	// cloud shadow: same shape as clouds, sampled shifted so it lands down-right of them
	cloud_texture = noiseTexture(
		(x,y) => [x / 50 + 50 - 0.4, y / 50 + 50 - 0.4],
		(b) => [0,0,0,cloudAlpha(b)*0.5])
	;
	// transparent clouds with 50 offset
	shadow_texture = noiseTexture(
		(x,y) => [x / 50 + 50, y / 50 + 50],
		(b) => [250,250,255,cloudAlpha(b)])
	;

}

function particle_setup() {
	cols = floor(width / scl);
	rows = floor(height / scl);
	flowfield = new Array(cols * rows);
	for (var i = 0; i < 300; i++) {
		particles[i] = new Particle();
	}
}

function setup() {
	particle_setup();
	worldmap_setup();
}


function draw() {
	image(world_texture,0,0);

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
			// push();
			// translate(x * scl, y * scl);
			// rotate(v.heading());
			// strokeWeight(1);
			// line(0, 0, scl, 0);
			// pop();
		}
		yoff += inc;

		zoff += 0.0003;
	}

	for (var i = 0; i < particles.length; i++) {
		particles[i].follow(flowfield);
		particles[i].update();
		particles[i].edges();
		particles[i].show();
	}
	image(cloud_texture,0,0);
	image(shadow_texture,0,0);

	// fr.html(floor(frameRate()));
}

// function windowResized() {
// 	resizeCanvas(windowWidth, windowHeight);
// }

