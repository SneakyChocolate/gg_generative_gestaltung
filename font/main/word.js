// Wort in ein Graphics malen und alle STEP px prüfen, ob dort Schrift ist.
function wordToPoints(word, step) {
	const pg = createGraphics(width, height);
	pg.pixelDensity(1);
	pg.background(0);
	pg.fill(255);
	pg.textAlign(CENTER, CENTER);
	pg.textStyle(BOLD);
	pg.textSize(min(width / (word.length * LETTER_WIDTH_RATIO), height * MAX_WORD_HEIGHT));
	pg.text(word, width / 2, height / 2);
	pg.loadPixels();

	const points = [];
	for (let y = 0; y < height; y += step) {
		for (let x = 0; x < width; x += step) {
			const isInk = pg.pixels[(y * width + x) * RGBA] > INK_THRESHOLD;
			if (isInk) points.push(createVector(x, y));
		}
	}
	pg.remove();
	return points;
}
