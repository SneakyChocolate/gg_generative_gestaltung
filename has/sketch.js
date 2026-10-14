const width = 500
const height = 500

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

// this function is used to create an off screen image texture based on noise.
// fn(num,num) [num;2], fn(number) [number;4]
function noiseTexture(offset_fn, rgba_fn, noise_fn = noise) {
	const tex = createImage(width, height);
	tex.loadPixels();
	for (let x = 0; x < width; x++) {
		for (let y = 0; y < height; y++) {
			let index = (x + y * width) * 4;
			// A Perlin noise brightness!
			let [ox,oy] = offset_fn(x, y);
			let bright = map(noise_fn(ox, oy), 0, 1, 0, 255);
			let [r,g,b,a] = rgba_fn(bright, x, y);
			tex.pixels[index] = r;
			tex.pixels[index + 1] = g;
			tex.pixels[index + 2] = b;
			tex.pixels[index + 3] = a;
		}
	}
	tex.updatePixels();
	return tex;
}

// list of noise layers, filled once in setup
let noiseLayers = [];

// every layer has its own frequency, strength, rotation and offset
function makeNoiseLayers(count, seed) {
	randomSeed(seed);
	let layers = [];
	for (let i = 0; i < count; i++) {
		layers.push({
			freq: pow(2, i),
			amp: pow(0.5, i),
			angle: random(TWO_PI),
			offset: random(1000),
		});
	}
	return layers;
}

// adds all layers together and divides by the sum of the strengths, so the result is 0 to 1
function customNoise(x, y) {
	let sum = 0;
	let total = 0;
	for (let i = 0; i < noiseLayers.length; i++) {
		let noiseLayer = noiseLayers[i];
		let rx = x * cos(noiseLayer.angle) - y * sin(noiseLayer.angle);
		let ry = x * sin(noiseLayer.angle) + y * cos(noiseLayer.angle);
		sum += noiseLayer.amp * noise(rx * noiseLayer.freq + noiseLayer.offset, ry * noiseLayer.freq + noiseLayer.offset);
		total += noiseLayer.amp;
	}
	return sum / total;
}

const clouds_count = 100;
function cloudAlpha(b) {
	return constrain((b - clouds_count) * 3, 0, 255);
}

// rotated + domain-warped noise coords: breaks up p5 noise()'s grid-aligned look
function cloudOffset(x, y, shift = 0) {
	const a = 0.5; // rotation in rad
	let ox = (x * cos(a) - y * sin(a)) / 50 + 50 - shift;
	let oy = (x * sin(a) + y * cos(a)) / 50 + 50 - shift;
	const warp = 2;
	return [
		ox + warp * (noise(ox + 100, oy) - 0.5),
		oy + warp * (noise(ox, oy + 100) - 0.5),
	];
}

// base noise gives continents; a second, finer noise only roughens the highlands
// (weight 0 on water/shore -> smooth coasts, 1 above h=0.65 -> rugged mountains)
function terrainHeight(h, x, y) {
	const detail = noise(x / 8 + 300, y / 8 + 300) - 0.5;
	const weight = constrain((h - 0.4) * 4, 0, 1);
	return constrain(h + detail * 0.4 * weight, 0, 1);
}

function setup() {
	background("white");
	noiseSeed(0);
	createCanvas(width, height);
	pixelDensity(1);
	print(`Canvas size is ${width}x${height}`);

	noiseLayers = makeNoiseLayers(4, 7);

	// noiseSeed is global and read at texture-build time: one seed per layer
	// world map
	image(noiseTexture(
		(x,y) => [x / 20 + 0, y / 20 + 0],
		(b,x,y) => lerpWorldMapRgba(terrainHeight(b/255, x, y)),
		customNoise),0,0
	);
	// cloud shadow: same seed as clouds, sampled shifted so it lands down-right of them
	image(noiseTexture(
		(x,y) => cloudOffset(x, y, 0.4),
		(b) => [0,0,0,cloudAlpha(b)*0.5]),0,0
	);

	// transparent clouds (seed must match shadow)
	image(noiseTexture(
		(x,y) => cloudOffset(x, y),
		(b) => [250,250,255,cloudAlpha(b)]),0,0
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

// notes
// customNoise() {stack und addiert mehrere noises und mapped die wieder auf 0-1}
// maybe mit rotate, scale mit random werten

