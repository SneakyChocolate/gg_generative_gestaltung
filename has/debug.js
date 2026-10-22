// debug overlay, toggle with the d key

function drawDebug() {
	// only update the fps number every 500ms so it is readable
	if (millis() - lastFpsUpdate > 500) {
		fps = frameRate();
		lastFpsUpdate = millis();
	}

	// background panel
	noStroke();
	fill(0, 0, 0, 160);
	rect(10, 10, 130, 78, 6);

	textFont('monospace');
	textSize(11);
	textAlign(LEFT, TOP);

	// fps is red when it gets low
	if (fps < 30) {
		fill(255, 80, 80);
	} else {
		fill(120, 255, 120);
	}
	text("FPS       " + fps.toFixed(1), 20, 18);

	fill(255);
	text("Particles " + particles.length, 20, 34);
	text("Time      " + floor(millis() / 1000) + " s", 20, 50);
	text("Size      " + width + "x" + height, 20, 66);
}
