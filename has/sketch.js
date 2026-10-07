var tex1
var tex2
var tex3
var tex4
const imgh = 250
const imgw = 250

function mynoise(tex,xoff, c, a) {
  for (let x = 0; x < imgw; x++) {
	let yoff = 0.0;
	for (let y = 0; y < imgh; y++) {
		// Use xoff and yoff for noise().
		let bright = map(noise(xoff, yoff), 0, 1, 0, 255);
		let alpha = map(noise(xoff, yoff), 0, 1, 0, 255);
		// Use x and y for the pixel position.
		let index = (x + y * imgw) * 4;
		// Set the red, green, blue, ana != undefined ? a : alphad alpha values.
		tex.pixels[index] = c == 'r' ? 255 : bright;
		tex.pixels[index + 1] = c == 'g' ? 255 : bright;
		tex.pixels[index + 2] = c == 'b' ? 255 : bright;
		tex.pixels[index + 3] = a != undefined ? a : alpha;
		// Increment yoff.
		yoff += 0.01;
	}
	// Increment xoff.
	xoff += 0.01;
	}
	tex.updatePixels();
	print(`Texture size is ${tex.width}x${tex.height}`);
}

// One-time initialisation at program start
function setup() {
	createCanvas(windowWidth, windowHeight);
	pixelDensity(1);
	print(`Canvas size is ${width}x${height}`);

	tex1 = createImage(imgw, imgh);
	tex2 = createImage(imgw, imgh);
	tex3 = createImage(imgw, imgh);
	tex4 = createImage(imgw, imgh);

	tex1.loadPixels();
	tex2.loadPixels();
	tex3.loadPixels();
	tex4.loadPixels();
	
	mynoise(tex1, 0.1, 'r', 10);
	mynoise(tex2, 0.1, 'g', 10);
	mynoise(tex3, 0.1, 'b', 10);
	mynoise(tex4, 0.1, 'b', 10);
}

// Called once per frame
function draw() {
// Start xoff at 0.
	image(tex1, 0, 0, imgw, imgh);
	image(tex2, imgw, 0, imgw, imgh);
	image(tex3, 0, imgh, imgw, imgh);
	image(tex4, imgw, imgh, imgw, imgh);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
