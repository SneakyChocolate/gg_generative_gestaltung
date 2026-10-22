
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
}
