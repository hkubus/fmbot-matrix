// @ts-expect-error
import { getColorFromURL } from "@delirius/color-thief-node";
import { Canvas, loadImage } from "@napi-rs/canvas";
import type { Database } from "better-sqlite3";
import type { Agent } from "stanza";
import type { Message } from "stanza/protocol";
import { reply } from "../index.ts";
import { getRecentTracks } from "../lastfm.ts";
import { findSize, isBright } from "../util.ts";

export async function run(client: Agent, message: Message, db: Database) {
	if (!message.from) return;
	const [, nickname] = message.from.split("/");

	const { lastfm } = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(nickname) as { lastfm: string };
	if (!lastfm)
		return reply(message, {
			body: "you need to set your lastfm account with .setname <lastfm>",
		});
	const tracks = await getRecentTracks(lastfm, 2);
	if (!tracks)
		return reply(message, { body: "fmbot why you trying not to laugh" });

	const coverImage = await loadImage(tracks[0].image);
	const canvas = new Canvas(1024, 512);
	const ctx = canvas.getContext("2d");

	const dominantColor = (await getColorFromURL(tracks[0].image)) as unknown as [
		number,
		number,
		number,
	];

	ctx.fillStyle = `#${dominantColor.map((e) => e.toString(16).padStart(2, "0")).join("")}`;
	ctx.beginPath();
	ctx.roundRect(10, 10, 1004, 492, 20);
	ctx.fill();
	ctx.closePath();

	const titleSize = findSize(ctx, tracks[0].title, 452);
	const center = Math.round((512 + titleSize - 120) / 2);

	ctx.font = `extrabold ${titleSize} DejaVu Sans Mono`;
	ctx.fillStyle = isBright(...dominantColor) ? "#000000bb" : "#ffffffbb";
	ctx.fillText(tracks[0].title, 502, center);
	ctx.font = "30px DejaVu Sans Mono";
	ctx.fillText(`${tracks[0].album}`, 502, center + 85);
	ctx.font = "bold 30px DejaVu Sans Mono";
	ctx.fillText(`${tracks[0].artist}`, 502, center + 45);
	ctx.fillText(`Previous track`, 502, 392);
	ctx.save();
	ctx.beginPath();
	ctx.roundRect(30, 30, 452, 452, 20);
	ctx.clip();
	ctx.drawImage(coverImage, 30, 30, 452, 452);
	ctx.restore();

	// second track
	ctx.beginPath();
	ctx.roundRect(502, 402, 492, 80, 20);
	ctx.fillStyle = isBright(...dominantColor) ? "#00000020" : "#ffffff20";
	ctx.fill();
	ctx.beginPath();
	ctx.roundRect(512, 412, 60, 60, 10);
	ctx.save();
	ctx.clip();
	const track = tracks.at(1);
	if (!track) return;
	const secondCover = await loadImage(track.image);

	ctx.drawImage(secondCover, 512, 412, 60, 60);
	ctx.restore();

	ctx.fillStyle = isBright(...dominantColor) ? "#000000bb" : "#ffffffbb";
	ctx.font = "bold 30px DejaVu Sans Mono";
	ctx.fillText(`${track.title}`, 582, 442);
	ctx.font = "20px DejaVu Sans Mono";
	ctx.fillText(`${track.artist}`, 582, 467);

	const blob = await canvas.convertToBlob({ mime: "image/png" });
	// @ts-expect-error
	const slot = await client.getUploadSlot(process.env.XMPP_UPLOAD_DOMAIN, {
		name: "img.png",
		size: blob.size,
		type: "request",
	});
	await fetch(slot.upload.url, { body: blob, method: "PUT" });

	reply(message, {
		body: `${slot.download}`,
		links: [{ description: "img", url: slot.download }],
	});
}
