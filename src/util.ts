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

export function splitText(text: string, maxLength = 25) {
	const lines: string[] = [];
	let currentLine = "";

	for (const word of text.split(" ")) {
		if (lines.length === 0 && (currentLine + word).length <= maxLength) {
			currentLine += (currentLine ? " " : "") + word;
		} else {
			if (currentLine) lines.push(currentLine);
			currentLine = word;
		}
	}

	if (currentLine) lines.push(currentLine);
	console.log(lines);
	if (lines.length === 1) {
		return [lines[0], ""];
	}
	lines[1] = lines.slice(1).join(" ");
	if (lines.length === 2) {
		return [
			lines[0],
			lines[1].length > maxLength ? `${lines[1].slice(0, maxLength - 3)}...` : lines[1],
		];
	}
	console.log(lines);
	return lines.slice(0, 2);
}
