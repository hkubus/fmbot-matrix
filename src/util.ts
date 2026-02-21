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

export function isBright(r: number, g: number, b: number) {
	const brightness = Math.sqrt(
		0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b),
	);
	return brightness > 127.5;
}

export function cutText(text: string, length: number) {
	text = text.trim();
	if (text.length <= length) return text;
	if (text.split("(")[0].trim().length <= length)
		return text.split("(")[0].trim();
	return `${text.slice(0, length - 3)}...`;
}
