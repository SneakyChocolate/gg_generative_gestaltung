
/// fn(num,num) [num;2], fn(number) [number;4]
function noiseTexture(offset_fn, rgba_fn) {
	const tex = createImage(100, 100);
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

// One-time initialisation at program start
function setup() {
	// createCanvas(windowWidth, windowHeight);
	createCanvas(100, 100);
	pixelDensity(1);
	print(`Canvas size is ${width}x${height}`);

	image(noiseTexture(
		(x,y) => [x * 0.1 + 0, y * 0.1 + 0],
		(b) => [b,0,0,b*2]),0,0
	);
	image(noiseTexture(
		(x,y) => [x * 0.1 + 50, y * 0.1 + 50],
		(b) => [0,b,0,b]),0,0
	);
	image(noiseTexture(
		(x,y) => [x * 0.1 + 100, y * 0.1 + 100],
		(b) => [0,0,b,b/2]),0,0
	);
}


function draw() {
	// background('black');
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}

