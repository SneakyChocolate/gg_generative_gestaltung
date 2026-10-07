var tex1
var tex2
var tex3
var tex4
const imgh = 250
const imgw = 250

function mynoise(tex,xoff, c, a, step) {
  for (let x = 0; x < imgw; x++) {
	let yoff = 0.0;
	for (let y = 0; y < imgh; y++) {
		let bright = map(noise(xoff, yoff), 0, 1, 0, 255);
		let alpha = map(noise(xoff, yoff), 0, 1, 0, 255);
		let index = (x + y * imgw) * 4;
		tex.pixels[index] = c == 'r' ? 255 : bright;
		tex.pixels[index + 1] = c == 'g' ? 255 : bright;
		tex.pixels[index + 2] = c == 'b' ? 255 : bright;
		tex.pixels[index + 3] = a != 0 ? a : alpha;
		yoff += step;
	}
	xoff += step;
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

	mynoise(tex1, 0.1, 'r', 10, 0.01);
	mynoise(tex2, 1, 'g', 30, 0.02);
	mynoise(tex3, 10, 'b', 70, 0.03);

	for (let i = 0; i < tex4.pixels.length; i += 4) {
		tex4.pixels[i]     = tex2.pixels[i];
		tex4.pixels[i + 1] = tex3.pixels[i + 1];
		tex4.pixels[i + 2] = tex1.pixels[i + 2];
		tex4.pixels[i + 3] = 255;
	}
	tex4.updatePixels();
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
