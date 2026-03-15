import type { DatabaseSync } from "node:sqlite";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";
import { getAlbum, getRecentTracks, searchAlbum } from "../lastfm.ts";

export async function run(
	client: MatrixClient,
	message: MessageEvent<MessageEventContent>,
	roomId: string,
	db: DatabaseSync,
) {
	const args = message.content.body?.split(" ").slice(1) || [];
	const lastfm = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(message.sender) as { lastfm: string };

	let artist = "";
	let album = "";
	if (args.length !== 0) {
		const searchResults = await searchAlbum(args.join(" "));
		if (searchResults) {
			artist = searchResults[0].artist;
			album = searchResults[0].title;
		}
	} else {
		const lastTrack = await getRecentTracks(lastfm.lastfm, 1);
		if (!lastTrack?.[0])
			return client.sendMessage(roomId, {
				msgtype: "m.text",
				body: "couldn't fetch recent tracks",
			});
		artist = lastTrack[0].artist;
		album = lastTrack[0].album;
	}
	const albumInfo = await getAlbum(album, artist, lastfm.lastfm);
	if (!albumInfo)
		return client.sendMessage(roomId, {
			msgtype: "m.text",
			body: "couldn't fetch album info",
		});
	client.sendMessage(roomId, {
		msgtype: "m.text",
		format: "org.matrix.custom.html",
		body: `${message.sender} has listened to \`${albumInfo.title}\` by ${albumInfo.artist} ${albumInfo.plays === "1" ? "once" : `${albumInfo.plays || 0} times`}`,
		mentions: {
			user_ids: [message.sender],
		},
		formatted_body: `<a href="https://matrix.to/#/${message.sender}">${message.sender.split(":")[0]}</a> has listened to \`${albumInfo.title}\` by ${albumInfo.artist} ${albumInfo.plays === "1" ? "once" : `${albumInfo.plays || 0} times`}`,
	});
}
