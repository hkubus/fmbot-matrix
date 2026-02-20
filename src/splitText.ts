import type { SKRSContext2D } from "@napi-rs/canvas";

export function findSize(
	ctx: SKRSContext2D,
	text: string,
	maxWidth = 400,
	maxSize = 100,
) {
	let currentSize = maxSize;
	while (true) {
		ctx.font = `extrabold ${currentSize} px Noto Sans`;
		const { width } = ctx.measureText(text);
		if (width < maxWidth) break;
		else {
			currentSize -= 5;
		}
	}
	return currentSize;
}
