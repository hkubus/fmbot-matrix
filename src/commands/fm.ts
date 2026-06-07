import type { DatabaseSync } from "node:sqlite";

import { GlobalFonts } from "@napi-rs/canvas";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";
import { getAlbum, getArtist, getRecentTracks, getTrack } from "../lastfm.ts";
import { generateImage, loadImageCached } from "../util.ts";

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
		.prepare("SELECT lastfm, style FROM users WHERE name = ?")
		.get(name) as { lastfm: string; style: number };
	let lastfm = result?.lastfm;
	const mention = message.content?.["m.mentions"]?.user_ids?.[0];
	const user: { lastfm: string; style: number } | null = mention
		? (db
				.prepare("SELECT lastfm, style FROM users WHERE name = ?")
				.get(mention) as {
				lastfm: string;
				style: number;
			})
		: null;
	if (!lastfm && !user?.lastfm)
		return client.sendMessage(roomId, {
			body: "couldnt fetch recent tracks",
			msgtype: "m.text",
		});
	if (user?.lastfm) lastfm = user?.lastfm;
	let tracks = await getRecentTracks(user?.lastfm || lastfm, 2);
	if (!tracks) tracks = await getRecentTracks(lastfm, 2);
	if (!tracks)
		return client.sendMessage(roomId, {
			msgtype: "m.text",
			body: "couldn't fetch recent tracks",
		});
	const coverImage = await loadImageCached(
		tracks[0].image === null
			? "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png"
			: tracks[0].image,
	);
	const trackTwo =
		(tracks[1].title === tracks[0].title ? tracks[2] : tracks[1]) || tracks[1];
	const trackResults = getTrack(tracks[0].title, tracks[0].artist, lastfm);
	const albumResults = getAlbum(tracks[0].album, tracks[0].artist, lastfm);
	const artistResults = getArtist(tracks[0].artist, lastfm);
	const scrobbles = {
		track: (await trackResults)?.plays || "0",
		artist: (await artistResults)?.plays || "0",
		album: (await albumResults)?.plays || "0",
	};

	if (!trackTwo) return;

	const secondCover =
		trackTwo.image === tracks[0].image
			? coverImage
			: await loadImageCached(trackTwo.image);

	const buffer = await generateImage(
		tracks[0],
		scrobbles,
		coverImage,
		trackTwo,
		secondCover,
		result?.style,
	);

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
