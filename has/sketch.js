const width = 500
const height = 500

const clouds_amount = 100;
const cloud_edge_sharpness = 6; // higher = clouds get opaque faster above the threshold


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
	// y outer: pixels are written in memory order
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let index = (x + y * width) * 4;
			// A Perlin noise brightness!
			let [ox,oy] = offset_fn(x, y);
			let bright = noise_fn(ox, oy) * 255;
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
		let angle = random(TWO_PI);
		layers.push({
			freq: pow(2, i),
			amp: pow(0.5, i),
			cos: cos(angle),
			sin: sin(angle),
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
		let rx = x * noiseLayer.cos - y * noiseLayer.sin;
		let ry = x * noiseLayer.sin + y * noiseLayer.cos;
		sum += noiseLayer.amp * noise(rx * noiseLayer.freq + noiseLayer.offset, ry * noiseLayer.freq + noiseLayer.offset);
		total += noiseLayer.amp;
	}
	return sum / total;
}

function cloudAlpha(b) {
	return constrain((b - clouds_amount) * cloud_edge_sharpness, 0, 255);
}

// base cloud layer: plain color
function cloudColor(brightness) {
	// dusk: dark violet at the edge -> dusty pink in the core, so the orange light blends into it
	let amount = map(brightness, clouds_amount, 255, 0, 1, true);
	return [lerp(70, 175, amount), lerp(55, 120, amount), lerp(100, 140, amount), cloudAlpha(brightness)];
}

// light layer on top of the clouds: sunset gradient, only visible where the cloud faces the sun
function cloudLightColor(brightness, x, y) {
	// 0 = cloud edge, 1 = cloud core
	let amount = map(brightness, clouds_amount, 255, 0, 1, true);

	let r, g, b;
	if (amount < 0.5) {
		// first half: purple-red -> orange
		let half = amount * 2;
		r = lerp(120, 255, half);
		g = lerp(30, 110, half);
		b = lerp(70, 40, half);
	} else {
		// second half: orange -> yellow
		let half = amount * 2 - 1;
		r = 255;
		g = lerp(110, 210, half);
		b = lerp(40, 100, half);
	}

	// sun sits west-north-west. Look sunward along the cloud height: if the cloud gets lower there,
	// this spot faces the sun (orange), if it gets higher it is in the cloud's own shade (dark)
	const sun = [-0.92, -0.38];
	const reach = 40; // px, bigger = wider lit area
	let [sx, sy] = cloudOffset(x + sun[0] * reach, y + sun[1] * reach);
	let brightnessSun = map(noise(sx, sy), 0, 1, 0, 255);
	let lit = constrain((brightness - brightnessSun) / 80, 0, 1);
	lit = lit * lit * (3 - 2 * lit); // smoothstep: soft transition instead of a hard orange edge

	return [r, g, b, cloudAlpha(brightness) * lit];
}

// rotated + domain-warped noise coords: breaks up p5 noise()'s grid-aligned look
function cloudOffset(x, y, shift = 0) {
	const c = cos(0.5), s = sin(0.5);
	let ox = (x * c - y * s) / 50 + 50 - shift;
	let oy = (x * s + y * c) / 50 + 50 - shift;
	const warp = 2;
	return [
		ox + warp * (noise(ox + 100, oy) - 0.5),
		oy + warp * (noise(ox, oy + 100) - 0.5),
	];
}

// base noise gives continents; a second, finer noise only roughens the highlands
// (weight 0 on water/shore -> smooth coasts, 1 above h=0.65 -> rugged mountains)
function terrainHeight(h, x, y) {
	const weight = map(h, 0.4, 0.65, 0, 1, true);
	if (weight === 0) return h; // skip noise on water/shore
	const detail = noise(x / 8 + 300, y / 8 + 300) - 0.5;
	return constrain(h + detail * 0.4 * weight, 0, 1);
}

function setup() {
	background("white");
	noiseSeed(0);
	createCanvas(width, height);
	pixelDensity(1);
	print(`Canvas size is ${width}x${height}`);
	const start = millis();

	noiseLayers = makeNoiseLayers(4, 7);

	// noiseSeed is global and read at texture-build time: one seed per layer
	// world map
	image(noiseTexture(
		(x,y) => [x / 20 + 0, y / 20 + 0],
		(b,x,y) => lerpWorldMapRgba(terrainHeight(b/255, x, y)),
		customNoise),0,0
	);

	// dusk tint over the whole map
	noStroke();
	fill(40, 20, 70, 110);
	rect(0, 0, width, height);

	// cloud shadow: same seed as clouds, sampled shifted so it lands down-right of them
	image(noiseTexture(
		(x,y) => cloudOffset(x, y, 0.4),
		(b) => [40,10,40,cloudAlpha(b)*0.5]),0,0
	);

	// transparent clouds (seed must match shadow)
	image(noiseTexture(
		(x,y) => cloudOffset(x, y),
		cloudColor),0,0
	);

	// light layer (same coords as clouds)
	image(noiseTexture(
		(x,y) => cloudOffset(x, y),
		cloudLightColor),0,0
	);
	print(`Image generated in ${((millis() - start) / 1000).toFixed(2)}s`);
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

// todo
// fps count und debug info
// mehr gui wie rahmen, bild centrieren, maybe halloween theme
