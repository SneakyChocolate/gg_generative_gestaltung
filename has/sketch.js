

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
	const tex = createImage(windowWidth, windowHeight);
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

function setup() {
	background("white");
	createCanvas(windowWidth, windowHeight);
	pixelDensity(1);
	print(`Canvas size is ${width}x${height}`);

	// world map
	image(noiseTexture(
		(x,y) => [x / 20 + 0, y / 20 + 0],
		(b) => lerpWorldMapRgba(b/255)),0,0
	);
	// transparent clouds with 50 offset
	image(noiseTexture(
		(x,y) => [x / 50 + 50, y / 50 + 50],
		(b) => [250,250,255,b*1.5]),0,0
	);
	// blendMode(MULTIPLY);
	// image(noiseTexture(
	// 	(x,y) => [x / 50 + 40, y / 50 + 50],
	// 	(b) => [255,255,0,255]),0,0
	// );
}


// function draw() {
// }

// function windowResized() {
// 	resizeCanvas(windowWidth, windowHeight);
// }

