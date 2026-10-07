var tex
const imgh = 500
const imgw = 500

// One-time initialisation at program start
function setup() {
	createCanvas(windowWidth, windowHeight);
	pixelDensity(1);
	print(`Canvas size is ${width}x${height}`);
	tex = createImage(imgw, imgh);

	tex.loadPixels();
	let xoff = 0.0;

	for (let x = 0; x < imgw; x++) {
	// For every xoff, start yoff at 0.
	let yoff = 0.0;

	for (let y = 0; y < imgh; y++) {
		// Use xoff and yoff for noise().
		let bright = map(noise(xoff, yoff), 0, 1, 0, 255);
		let alpha = map(noise(xoff, yoff), 0, 1, 0, 255);
		// Use x and y for the pixel position.
		let index = (x + y * imgw) * 4;
		// Set the red, green, blue, and alpha values.
		tex.pixels[index] = 255;
		tex.pixels[index + 1] = bright;
		tex.pixels[index + 2] = bright;
		tex.pixels[index + 3] = alpha;
		// Increment yoff.
		yoff += 0.01;
	}
	// Increment xoff.
	xoff += 0.01;
	}
	tex.updatePixels();
	print(`Texture size is ${tex.width}x${tex.height}`);
}

// Called once per frame
function draw() {
// Start xoff at 0.
	image(tex, 0, 0, imgw, imgh);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
