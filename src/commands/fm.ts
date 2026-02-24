// @ts-expect-error
import { getColor } from "@delirius/color-thief-node";
import { Canvas, loadImage } from "@napi-rs/canvas";
import type { Database } from "better-sqlite3";
import dayjs from "dayjs";
import type { Agent } from "stanza";
import type { Message } from "stanza/protocol";
import { reply } from "../index.ts";
import { getRecentTracks } from "../lastfm.ts";
import { cutText, findSize, isBright, splitText } from "../util.ts";

export async function run(client: Agent, message: Message, db: Database) {
	if (!message.from) return;
	const [, nickname] = message.from.split("/");

	const lastfm = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(nickname) as { lastfm: string };

	const args = message.body?.split(" ").slice(1) || [];
	const user: { lastfm: string } = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(args[0]?.split(",")[0]) as { lastfm: string };
	if (!lastfm && !user)
		return reply(message, {
			body: "you need to set your lastfm account with .setname <lastfm>",
		});
	let tracks = await getRecentTracks(user?.lastfm || lastfm.lastfm, 2);
	if (!tracks) tracks = await getRecentTracks(lastfm.lastfm, 2);
	if (!tracks) return reply(message, { body: "couldn't fetch recent tracks" });

	const coverImage = await loadImage(tracks[0].image);
	const canvas = new Canvas(1024, 512);
	const ctx = canvas.getContext("2d");

	const dominantColor = (await getColor(coverImage)) as unknown as [
		number,
		number,
		number,
	];

	ctx.fillStyle = `#${dominantColor.map((e) => e.toString(16).padStart(2, "0")).join("")}`;
	ctx.beginPath();
	ctx.roundRect(10, 10, 1004, 492, 20);
	ctx.fill();
	ctx.closePath();
	// const title = cutText(tracks[0].title, 25);
	const title = splitText(tracks[0].title, 20);
	const bright = isBright(...dominantColor);
	const titleSize = findSize(
		ctx,
		title[0].length > title[1].length ? title[0] : title[1],
		452,
	);
	const center = Math.round((512 + titleSize - 120) / 2);
	ctx.font = `extrabold ${titleSize} DejaVu Sans Mono`;
	ctx.fillStyle = bright ? "#000000bb" : "#ffffffbb";
	if (title[1]) {
		ctx.fillText(title[0], 502, center - titleSize);
		ctx.fillText(title[1], 502, center);
	} else ctx.fillText(title[0], 502, center);
	ctx.font = "30px DejaVu Sans Mono";
	const album = splitText(tracks[0].album);
	if (album[1]) {
		ctx.fillText(`${cutText(album[0], 25)}`, 502, center + 85);
		ctx.fillText(`${cutText(album[1], 25)}`, 502, center + 125);
	} else {
		ctx.fillText(`${cutText(tracks[0].album, 25)}`, 502, center + 85);
	}
	ctx.font = "bold 30px DejaVu Sans Mono";
	ctx.fillText(`${cutText(tracks[0].artist, 25)}`, 502, center + 45);
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
	ctx.fillStyle = bright ? "#00000020" : "#ffffff20";
	ctx.fill();
	ctx.beginPath();
	ctx.roundRect(512, 412, 60, 60, 10);
	ctx.save();
	ctx.clip();
	const track =
		(tracks[1].title === tracks[0].title ? tracks[2] : tracks[1]) || tracks[1];
	if (!track) return;
	const secondCover = await loadImage(track.image);
	ctx.drawImage(secondCover, 512, 412, 60, 60);
	ctx.restore();

	ctx.fillStyle = bright ? "#000000bb" : "#ffffffbb";
	ctx.font = "bold 30px DejaVu Sans Mono";
	ctx.fillText(`${cutText(track.title, 20)}`, 582, 442);
	ctx.font = "20px DejaVu Sans Mono";
	ctx.fillText(`${cutText(track.artist, 20)}`, 582, 467);
	ctx.textAlign = "right";
	ctx.fillText(`${dayjs(track.date).locale("en").fromNow()}`, 982, 467);

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
