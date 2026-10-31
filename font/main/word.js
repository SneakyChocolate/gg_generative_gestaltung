function wordToPoints(word) {
	const wordImage = drawWordImage(word);
	const inkPoints = findInkPoints(wordImage);
	const particleCount = word.length * PARTICLES_PER_LETTER;
	return shuffle(inkPoints).slice(0, particleCount);
}

function drawWordImage(word) {
	const image = createGraphics(width, height);
	image.pixelDensity(1);
	image.background(PAPER_COLOR);
	image.fill(INK_COLOR);
	image.textAlign(CENTER, CENTER);
	image.textStyle(BOLD);
	image.textSize(fontSizeFor(word));
	image.text(word, width / 2, height / 2);
	image.loadPixels();
	return image;
}

function fontSizeFor(word) {
	const sizeThatFitsWidth = width / (word.length * LETTER_WIDTH_RATIO);
	const sizeThatFitsHeight = height * MAX_WORD_HEIGHT_RATIO;
	return min(sizeThatFitsWidth, sizeThatFitsHeight);
}

function findInkPoints(image) {
	const points = [];
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (isInk(image, x, y)) points.push(createVector(x, y));
		}
	}
	image.remove();
	return points;
}

function isInk(image, x, y) {
	const redValue = image.pixels[(y * width + x) * VALUES_PER_PIXEL];
	return redValue > INK_THRESHOLD;
}
