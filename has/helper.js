
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

const normalLayers = [
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

const autumnLayers = [
	[0.1,0,0,60,255],
	[0.3,30,40,100,255],
	[0.35,170,140,80,255],
	[0.4,110,75,35,255],
	[0.6,180,120,45,255],
	[0.65,50,50,50,255],
	[0.7,100,100,100,255],
	[0.9,150,150,150,255],
	[0.91,255,255,255,255],
	[1,255,255,255,255]
];

// same as harden world map but just soft edges via lerp
function lerpWorldMapRgba(height, layers = normalLayers) {
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
/// fn(num,num) [num;2], fn(number, x, y) [number;4], fn(x, y, noise_value) void,
function noiseTexture(offset_fn, rgba_fn, noise_fn = noise, pre_noise_fn) {
	const tex = createImage(width, height);
	tex.loadPixels();
	// y outer: pixels are written in memory order
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let index = (x + y * width) * 4;
			// A Perlin noise brightness!
			let [ox,oy] = offset_fn(x, y);
			const noise_value = noise_fn(ox, oy);
			let bright = noise_value * 255;
			if (pre_noise_fn) pre_noise_fn(x, y, noise_value);
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

// AI-generated (Claude)
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

// AI-generated (Claude)
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

// AI-generated (Claude)
function cloudAlpha(b) {
	return map(b, clouds_count, clouds_count + 255 / cloud_edge_sharpness, 0, 255, true);
}

// AI-generated (Claude)
// base cloud layer: plain color
function cloudColor(brightness) {
	// dusk: dark violet at the edge -> dusty pink in the core, so the orange light blends into it
	let amount = map(brightness, clouds_count, 255, 0, 1, true);
	return [lerp(70, 175, amount), lerp(55, 120, amount), lerp(100, 140, amount), cloudAlpha(brightness)];
}

// AI-generated (Claude)
// light layer on top of the clouds: sunset gradient, only visible where the cloud faces the sun
function cloudLightColor(brightness, x, y) {
	// 0 = cloud edge, 1 = cloud core
	let amount = map(brightness, clouds_count, 255, 0, 1, true);

	// first half: purple-red -> orange, second half: orange -> yellow
	let toOrange = map(amount, 0, 0.5, 0, 1, true);
	let toYellow = map(amount, 0.5, 1, 0, 1, true);
	let r = lerp(120, 255, toOrange);
	let g = lerp(lerp(30, 110, toOrange), 210, toYellow);
	let b = lerp(lerp(70, 40, toOrange), 100, toYellow);

	// sun sits west-north-west. Look sunward along the cloud height: if the cloud gets lower there,
	// this spot faces the sun (orange), if it gets higher it is in the cloud's own shade (dark)
	const sun = [-0.92, -0.38];
	const reach = 40; // px, bigger = wider lit area
	let [sx, sy] = cloudOffset(x + sun[0] * reach, y + sun[1] * reach);
	let brightnessSun = noise(sx, sy) * 255;
	let lit = map(brightness - brightnessSun, 0, 80, 0, 1, true);
	lit = lit * lit * (3 - 2 * lit); // smoothstep: soft transition instead of a hard orange edge

	return [r, g, b, cloudAlpha(brightness) * lit];
}

// AI-generated (Claude)
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

const rain_peak_density = clouds_count + 10;
const rain_density_falloff = 30;
const rain_max_spawn_tries = 30;

function cloudDensityAt(x, y) {
	const [noiseX, noiseY] = cloudOffset(x, y);
	return noise(noiseX, noiseY) * 255;
}

function rainChanceAt(x, y) {
	const distanceToPeak = abs(cloudDensityAt(x, y) - rain_peak_density);
	return map(distanceToPeak, 0, rain_density_falloff, 1, 0, true);
}

// rain spawns at the cloud edge: thick clouds would hide it, clear sky has no rain
function rainSpawnPosition() {
	for (let tries = 0; tries < rain_max_spawn_tries; tries++) {
		const x = random(width);
		const y = random(height);
		if (random() < rainChanceAt(x, y)) return createVector(x, y);
	}
	return createVector(random(width), random(height));
}

// AI-generated (Claude)
// base noise gives continents; a second, finer noise only roughens the highlands
// (weight 0 on water/shore -> smooth coasts, 1 above h=0.65 -> rugged mountains)
function terrainHeight(h, x, y) {
	const weight = map(h, 0.4, 0.65, 0, 1, true);
	if (weight === 0) return h; // skip noise on water/shore
	const detail = noise(x / 8 + 300, y / 8 + 300) - 0.5;
	return constrain(h + detail * 0.4 * weight, 0, 1);
}

// 0 = normal biome, 1 = autumn biome. very coarse noise -> big patches, soft edges
function autumnAmount(x, y) {
	return map(noise(x / 200 + 500, y / 200 + 500), 0.45, 0.55, 0, 1, true);
}

// noise on the land makes all colors lighter or darker: same hue, only light and shadow
function autumnLeaves(height, x, y) {
	const rgba = lerpWorldMapRgba(height, autumnLayers);
	const isGrass = map(height, 0.35, 0.4, 0, 1, true) * map(height, 0.6, 0.65, 1, 0, true);
	const shade = (noise(x / 25, y / 25) - 0.5) * 80 * isGrass;

	for (let i = 0; i < 3; i++) {
		rgba[i] += shade;
	}

	return rgba;
}

function worldmap_setup() {
	print(`Canvas size is ${width}x${height}`);

	world_noise = new Array(width);
	for (let i = 0; i < width; i ++) {
		world_noise[i] = new Array(height);
	}

	noiseLayers = makeNoiseLayers(4, 7);

	// world map (world_noise feeds the particle flowfield)
	world_texture = noiseTexture(
		(x,y) => [x / 20, y / 20],
		(b,x,y) => {
			const height = terrainHeight(b/255, x, y);
			const normal = lerpWorldMapRgba(height);
			const autumn = autumnLeaves(height, x, y);
			const amount = autumnAmount(x, y);
			return normal.map((value, i) => lerp(value, autumn[i], amount));
		},
		customNoise,
		(x, y, noise_value) => { world_noise[x][y] = noise_value; }
	);

	// dusk tint over the whole map
	world_texture.loadPixels();
	const tint = [40, 20, 70, 110 / 255];
	for (let i = 0; i < world_texture.pixels.length; i += 4) {
		for (let c = 0; c < 3; c++) {
			world_texture.pixels[i + c] = lerp(world_texture.pixels[i + c], tint[c], tint[3]);
		}
	}
	world_texture.updatePixels();

	// cloud shadow: same seed as clouds, sampled shifted so it lands down-right of them
	shadow_texture = noiseTexture(
		(x,y) => cloudOffset(x, y, 0.4),
		(b) => [40,10,40,cloudAlpha(b)*0.5]
	);

	// transparent clouds (seed must match shadow)
	cloud_texture = noiseTexture(cloudOffset, cloudColor);

	// light layer (same coords as clouds)
	light_texture = noiseTexture(cloudOffset, cloudLightColor);

	// clouds never change, so draw all three layers once into one image
	sky_texture = createGraphics(width, height);
	sky_texture.pixelDensity(1);
	sky_texture.image(shadow_texture, 0, 0);
	sky_texture.image(cloud_texture, 0, 0);
	sky_texture.image(light_texture, 0, 0);
}

function particle_setup() {
	cols = floor(width / scl);
	rows = floor(height / scl);
	flowfield = new Array(cols * rows);

	for (let x = 0; x < cols; x++) {
		for (let y = 0; y < rows; y++) {
			const field = world_noise[x][y];
			const around = [
				[1,0], // 90
				[1,-1], // 135
				[0,-1], // 180
				[-1,-1], // 225
				[-1,0], // 270
				[-1,1], // 315
				[0,1], // 0
				[1,1], // 45
			];
			var min = field;
			var v = createVector(0, 0);
			var flows = false;

			for (let r = 0; r < around.length; r++) {
				const dx = around[r][0];
				const dy = around[r][1];
				const cx = dx + x;
				const cy = dy + y;

				if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
					var neighbor = world_noise[cx][cy];

					if (neighbor < min) {
						min = neighbor;
						v = createVector(dx, dy);
						flows = true;
					}
				}
			}

			if (flows) v.setMag((field - min) * 20);
			flowfield[x + y * cols] = v;
		}
	}

	// for (var i = 0; i < 300; i++) {
	// 	particles[i] = new Particle();
	// }
	particles = new Particles(10);
}

function iter(list, handle_fn) {
	for (let i = 0; i < length; i ++) {
		handle_fn(list[i]);
	}
}
function iter2(length, handle_fn) {
	for (let i = 0; i < length - 1; i ++) {
		for (let i2 = i + 1; i2 < length; i2 ++) {
			handle_fn(i, i2);
		}
	}
}
