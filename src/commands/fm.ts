import { profile, profileEnd } from "node:console";
import type { DatabaseSync } from "node:sqlite";
// @ts-expect-error
import { getColor } from "@delirius/color-thief-node";
import { Canvas, loadImage } from "@napi-rs/canvas";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";
import dayjs from "dayjs";
import { getRecentTracks } from "../lastfm.ts";
import { cutText, findSize, isBright, splitText } from "../util.ts";

profile();
export async function run(
	client: MatrixClient,
	message: MessageEvent<
		MessageEventContent & { "m.mentions"?: { user_ids?: string[] } }
	>,
	roomId: string,
	db: DatabaseSync,
) {
	const name = message.sender;
	const lastfm = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(name) as { lastfm: string };

	const mention = message.content?.["m.mentions"]?.user_ids?.[0];
	console.log(message.content);
	const user: { lastfm: string } | null = mention
		? (db.prepare("SELECT lastfm FROM users WHERE name = ?").get(mention) as {
				lastfm: string;
			})
		: null;
	if (!lastfm && !user)
		return client.sendMessage(roomId, {
			msgtype: "m.text",
			body: "you need to set your lastfm account with .setname <lastfm>",
		});
	let tracks = await getRecentTracks(user?.lastfm || lastfm.lastfm, 2);
	if (!tracks) tracks = await getRecentTracks(lastfm.lastfm, 2);
	if (!tracks)
		return client.sendMessage(roomId, {
			msgtype: "m.text",
			body: "couldn't fetch recent tracks",
		});

	const coverImage = await loadImage(tracks[0].image);
	const canvas = new Canvas(2048, 1024);
	const ctx = canvas.getContext("2d");

	const dominantColor = (await getColor(coverImage)) as unknown as [
		number,
		number,
		number,
	];

	ctx.fillStyle = `#${dominantColor.map((e) => e.toString(16).padStart(2, "0")).join("")}`;
	ctx.beginPath();
	ctx.roundRect(20, 20, 2008, 984, 40);
	ctx.fill();
	ctx.closePath();
	// const title = cutText(tracks[0].title, 25);
	const title = splitText(tracks[0].title, 20);
	const bright = isBright(...dominantColor);
	const titleSize = findSize(
		ctx,
		title[0].length > title[1].length ? title[0] : title[1],
		954,
	);
	const center = Math.round((1024 + titleSize - 240) / 2);
	ctx.font = `extrabold ${titleSize} DejaVu Sans Mono`;
	ctx.fillStyle = bright ? "#000000bb" : "#ffffffbb";
	if (title[1]) {
		ctx.fillText(title[0], 1004, center - titleSize);
		ctx.fillText(title[1], 1004, center);
	} else ctx.fillText(title[0], 1004, center);
	ctx.font = "60px DejaVu Sans Mono";
	const album = splitText(tracks[0].album);
	if (album[1]) {
		ctx.fillText(`${cutText(album[0], 25)}`, 1004, center + 170);
		ctx.fillText(`${cutText(album[1], 25)}`, 1004, center + 250);
	} else {
		ctx.fillText(`${cutText(tracks[0].album, 25)}`, 1004, center + 170);
	}
	ctx.font = "bold 60px DejaVu Sans Mono";
	ctx.fillText(`${cutText(tracks[0].artist, 25)}`, 1004, center + 90);
	ctx.fillText(`Previous track`, 1004, 784);
	ctx.save();
	ctx.beginPath();
	ctx.roundRect(60, 60, 904, 904, 40);
	ctx.clip();
	ctx.drawImage(coverImage, 60, 60, 904, 904);
	ctx.restore();
	// second track
	ctx.beginPath();
	ctx.roundRect(1004, 804, 984, 160, 40);
	ctx.fillStyle = bright ? "#00000020" : "#ffffff20";
	ctx.fill();
	ctx.beginPath();
	ctx.roundRect(1024, 824, 120, 120, 20);
	ctx.save();
	ctx.clip();
	const track =
		(tracks[1].title === tracks[0].title ? tracks[2] : tracks[1]) || tracks[1];
	if (!track) return;
	const secondCover =
		track.image === tracks[0].image ? coverImage : await loadImage(track.image);
	ctx.drawImage(secondCover, 1024, 824, 120, 120);
	ctx.restore();

	ctx.fillStyle = bright ? "#000000bb" : "#ffffffbb";
	ctx.font = "bold 60px DejaVu Sans Mono";
	ctx.fillText(`${cutText(track.title, 20)}`, 1164, 884);
	ctx.font = "40px DejaVu Sans Mono";
	ctx.fillText(`${cutText(track.artist, 20)}`, 1164, 934);
	ctx.textAlign = "right";
	ctx.fillText(`${dayjs(track.date).locale("en").fromNow()}`, 1964, 934);

	const buffer = await canvas.toBuffer("image/png");
	const encrypted = await client.crypto.encryptMedia(buffer);
	const mxc = await client.uploadContent(encrypted.buffer);
	await client.sendMessage(roomId, {
		body: "image.png",
		msgtype: "m.image",
		info: {
			mimetype: "image/png",
			size: buffer.length,
			w: 2048,
			h: 1024,
		},
		file: {
			url: mxc,
			...encrypted.file,
		},
	});
	// // @ts-expect-error
	// const slot = await client.getUploadSlot(process.env.XMPP_UPLOAD_DOMAIN, {
	// 	name: "img.png",
	// 	size: blob.size,
	// 	type: "request",
	// });
	// await fetch(slot.upload.url, { body: blob, method: "PUT" });
	// reply(message, {
	// 	body: `${slot.download}`,
	// 	links: [{ description: "img", url: slot.download }],
	// });
	profileEnd();
}
