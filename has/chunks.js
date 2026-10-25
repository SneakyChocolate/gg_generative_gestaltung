
class GridChunks {
	// fn(i32, i32, fn(T) [x, y])
	constructor(width, height, position_fn) {
		this.position_fn = position_fn;
		this.width = width;
		this.height = height;
		this.items = new Array(width * height);
		for (let i = 0; i < this.items.length; i ++) {
			this.items[i] = [];
		}
	}

	// fn([T]) void
	update(list) {
		for (let i = 0; i < this.items.length; i ++) {
			this.items[i].length = 0;
		}
		for (let i = 0; i < list.length; i ++) {
			let [x, y] = this.position_fn(list[i]);
			this.items[x + y * this.width].push(i);
		}
	}

	// fn(fn([i32]))
	iterGroups(handle_fn) {
		for (let x = 0; x < this.width; x ++) {
			for (let y = 0; y < this.height; y ++) {
				handle_fn(this.items[x + y * this.width]);
			}
		}
	}


	// AI GENERATED
	// Iterates unique pairs within the chunk and across valid neighbor chunks
	iterCollisionPairs(pair_fn) {
		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				let currentChunk = this.items[x + y * this.width];
				if (currentChunk.length === 0) continue;

				// 1. Check items within the same chunk against each other
				for (let i = 0; i < currentChunk.length - 1; i++) {
					for (let j = i + 1; j < currentChunk.length; j++) {
						pair_fn(currentChunk[i], currentChunk[j]);
					}
				}

				// 2. Check current chunk items against half-neighborhood 
				// (Offsets ensure we don't double-check pairs between adjacent chunks)
				const offsets = [
					[1, 0],   // Right
					[1, 1],   // Bottom-Right
					[0, 1],   // Bottom
					[-1, 1]   // Bottom-Left
				];

				for (let [dx, dy] of offsets) {
					let nx = x + dx;
					let ny = y + dy;
					if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
						let neighborChunk = this.items[nx + ny * this.width];
						if (neighborChunk.length === 0) continue;

						for (let i = 0; i < currentChunk.length; i++) {
							for (let j = 0; j < neighborChunk.length; j++) {
								pair_fn(currentChunk[i], neighborChunk[j]);
							}
						}
					}
				}
			}
		}
	}
}
