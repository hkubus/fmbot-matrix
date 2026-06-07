import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	Canvas,
	type Image,
	loadImage,
	type SKRSContext2D,
} from "@napi-rs/canvas";
import dayjs from "dayjs";
import type { Track } from "./lastfm";

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
	return brightness > 127;
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
	if (lines.length === 1) {
		return [lines[0], ""];
	}
	lines[1] = lines.slice(1).join(" ");
	if (lines.length === 2) {
		return [
			lines[0],
			lines[1].length > maxLength
				? `${lines[1].slice(0, maxLength - 3)}...`
				: lines[1],
		];
	}
	return lines.slice(0, 2);
}

export async function getDominantColor(image: Image) {
	const canvas = new Canvas(64, 64);
	const ctx = canvas.getContext("2d");
	const colors = [];
	ctx.filter = "blur(64px)";
	ctx.drawImage(
		image,
		image.width * 0.9,
		0,
		image.width * 0.1,
		image.height,
		0,
		0,
		64,
		64,
	);
	colors.push(ctx.getImageData(32, 0, 1, 1).data.slice(0, 3));
	colors.push(ctx.getImageData(32, 32, 1, 1).data.slice(0, 3));
	colors.push(ctx.getImageData(32, 63, 1, 1).data.slice(0, 3));
	return Array.from(colors);
}
export async function generateImage(
	track1: Track,
	track1Scrobbles: { track: string; album: string; artist: string },
	track1Cover: Image,
	track2: Track,
	track2Cover: Image,
	style = 1,
) {
	const canvas = new Canvas(2048, 1024);
	const ctx = canvas.getContext("2d");

	const dominantColor = await getDominantColor(track1Cover);
	const dominantColorHex = [
		dominantColor[0][0].toString(16),
		dominantColor[0][1].toString(16),
		dominantColor[0][2].toString(16),
	];
	// @ts-expect-error
	let bright = dominantColor.map((e) => isBright(...e));
	ctx.fillStyle = `#${dominantColorHex.map((e) => e.padStart(2, "0")).join("")}`;
	ctx.beginPath();
	ctx.roundRect(20, 20, 2008, 984, 40);
	ctx.clip();
	ctx.fill();
	if (style === 1) {
		ctx.filter = "blur(15px)";
		ctx.drawImage(track1Cover, 20, 20, 984, 984);
		ctx.filter = `blur(50px)`;

		ctx.drawImage(
			track1Cover,
			track1Cover.width * 0.9,
			0,
			track1Cover.width * 0.1,
			track1Cover.height,
			984,
			20,
			1044,
			984,
		);
		ctx.fillStyle = `#${dominantColorHex.map((e) => e.padStart(2, "0")).join("")}30`;
		ctx.filter = "none";
		ctx.fill();
	} else {
		bright = bright.map(() => bright[1]);
	}
	ctx.closePath();
	// const title = cutText(track1.title, 25);
	const title = splitText(track1.title, 20);
	const titleSize = findSize(
		ctx,
		title[0].length > title[1].length ? title[0] : title[1],
		950,
	);
	const center = Math.round((1024 + titleSize - 240) / 2);

	// scrobbles
	ctx.fillStyle = bright[0] ? "#000000cd" : "#ffffffcd";
	ctx.font = `bold 60px "NotoEmoji"`;
	ctx.fillText(`🎶`, 1004, 150);
	ctx.fillText(`💽`, 1004 + 332, 150);
	ctx.fillText(`👤`, 1004 + 652, 150);
	ctx.font = `bold 60px DejaVu Sans Mono`;
	ctx.fillText(track1Scrobbles.track, 1004 + 90, 150);
	ctx.fillText(track1Scrobbles.album, 1004 + 332 + 90, 150);
	ctx.fillText(track1Scrobbles?.artist, 1004 + 652 + 90, 150);
	ctx.textAlign = "left";
	// current track text
	ctx.fillStyle = bright[1] ? "#000000cd" : "#ffffffcd";
	ctx.font = `extrabold ${titleSize} DejaVu Sans Mono`;
	if (title[1]) {
		ctx.fillText(title[0], 1004, center - titleSize);
		ctx.fillText(title[1], 1004, center);
	} else ctx.fillText(title[0], 1004, center);
	ctx.font = "60px DejaVu Sans Mono";
	const album = splitText(track1.album);
	if (album[1]) {
		ctx.fillText(`${cutText(album[0], 25)}`, 1004, center + 170);
		ctx.fillText(`${cutText(album[1], 25)}`, 1004, center + 250);
	} else {
		ctx.fillText(`${cutText(track1.album, 25)}`, 1004, center + 170);
	}
	ctx.font = "bold 60px DejaVu Sans Mono";
	ctx.fillText(`${cutText(track1.artist, 25)}`, 1004, center + 90);
	// second track
	ctx.fillStyle = bright[2] ? "#000000bb" : "#ffffffbb";
	ctx.fillText(`Previous track`, 1004, 784);
	ctx.save();
	ctx.beginPath();
	ctx.roundRect(60, 60, 904, 904, 40);
	ctx.clip();
	ctx.drawImage(track1Cover, 60, 60, 904, 904);
	ctx.restore();

	ctx.beginPath();
	ctx.roundRect(1004, 804, 984, 160, 40);
	ctx.fillStyle = bright[1] ? "#00000020" : "#ffffff20";
	ctx.fill();
	ctx.beginPath();
	ctx.roundRect(1024, 824, 120, 120, 20);
	ctx.save();
	ctx.clip();
	ctx.drawImage(track2Cover, 1024, 824, 120, 120);
	ctx.restore();

	ctx.fillStyle = bright[2] ? "#000000bb" : "#ffffffbb";
	ctx.font = "bold 60px DejaVu Sans Mono";
	ctx.fillText(`${cutText(track2.title, 20)}`, 1164, 884);
	ctx.font = "40px DejaVu Sans Mono";
	ctx.fillText(`${cutText(track2.artist, 20)}`, 1164, 934);
	ctx.textAlign = "right";
	ctx.fillText(`${dayjs(track2.date).locale("en").fromNow()}`, 1964, 934);
	return canvas.toBuffer("image/png");
}
const missing =
	"https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png";
export async function loadImageCached(url: string) {
	if (process.env.COVER_CACHE !== "true") return loadImage(url);
	const hash = url.split("/").at(-1)?.split(".").at(0);

	const path = join(import.meta.dirname, "..", "cache", `${hash}.png`);
	const exists = existsSync(path);
	if (exists) return loadImage(path);
	const image = await fetch(url);
	if (!image.ok) return loadImageCached(missing);
	const data = await image.bytes();
	await writeFile(path, data);
	return loadImage(path);
}
