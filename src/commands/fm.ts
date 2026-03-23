import type { DatabaseSync } from "node:sqlite";
// @ts-expect-error
import { getColor } from "@delirius/color-thief-node";
import { Canvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";
import dayjs from "dayjs";
import { getAlbum, getArtist, getRecentTracks, getTrack } from "../lastfm.ts";
import { cutText, findSize, isBright, splitText } from "../util.ts";

GlobalFonts.registerFromPath(
	`${import.meta.dirname}/../../fonts/noncolor.ttf`,
	"NotoEmoji",
);
export async function run(
	client: MatrixClient,
	message: MessageEvent<
		MessageEventContent & { "m.mentions"?: { user_ids?: string[] } }
	>,
	roomId: string,
	db: DatabaseSync,
) {
	const name = message.sender;
	const result = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(name) as { lastfm: string };
	let lastfm = result?.lastfm;
	const mention = message.content?.["m.mentions"]?.user_ids?.[0];
	const user: { lastfm: string } | null = mention
		? (db.prepare("SELECT lastfm FROM users WHERE name = ?").get(mention) as {
				lastfm: string;
			})
		: null;
	if (!lastfm && !user?.lastfm)
		return client.sendMessage(roomId, {
			body: "you need to set your lastfm account with .setname <lastfm>",
		});

	if (user?.lastfm) lastfm = user?.lastfm;
	let tracks = await getRecentTracks(user?.lastfm || lastfm, 2);
	if (!tracks) tracks = await getRecentTracks(lastfm, 2);
	if (!tracks)
		return client.sendMessage(roomId, {
			body: "couldnt fetch recent tracks",
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
		950,
	);
	const center = Math.round((1024 + titleSize - 240) / 2);
	const trackResults = await getTrack(
		tracks[0].title,
		tracks[0].artist,
		lastfm,
	);
	const albumResults = await getAlbum(
		tracks[0].album,
		tracks[0].artist,
		lastfm,
	);
	const artistResults = await getArtist(tracks[0].artist, lastfm);
	// scrobbles
	ctx.fillStyle = bright ? "#000000bb" : "#ffffffbb";
	ctx.font = `bold 60px "NotoEmoji"`;
	ctx.fillText(`🎶`, 1004, 150);
	ctx.fillText(`💽`, 1004 + 332, 150);
	ctx.fillText(`👤`, 1004 + 652, 150);
	ctx.font = `bold 60px DejaVu Sans Mono`;
	ctx.fillText(trackResults?.plays || 0, 1004 + 90, 150);
	ctx.fillText(albumResults?.plays || 0, 1004 + 332 + 90, 150);
	ctx.fillText(artistResults?.plays || 0, 1004 + 652 + 90, 150);
	ctx.textAlign = "left";
	// current track text
	ctx.font = `extrabold ${titleSize} DejaVu Sans Mono`;
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
	// second track
	ctx.fillText(`Previous track`, 1004, 784);
	ctx.save();
	ctx.beginPath();
	ctx.roundRect(60, 60, 904, 904, 40);
	ctx.clip();
	ctx.drawImage(coverImage, 60, 60, 904, 904);
	ctx.restore();
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
}
