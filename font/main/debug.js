let isDebugVisible = false;

function toggleDebug() {
	isDebugVisible = !isDebugVisible;
}

function debugLines() {
	return [
		`FPS: ${frameRate().toFixed(1)}`,
		`Particles: ${particleCount()}`,
		`Time: ${(millis() / 1000).toFixed(1)} s`,
		`Frame: ${frameCount}`,
	];
}

function renderDebug() {
	if (!isDebugVisible) return;
	noStroke();
	fill([220, 220, 220]);
	textAlign(LEFT, TOP);
	textSize(14);
	debugLines().forEach((line, index) => {
		text(line, 12, 12 + index * 20);
	});
}
