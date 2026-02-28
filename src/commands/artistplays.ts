import type { DatabaseSync } from "node:sqlite";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";
import { getArtist, getRecentTracks, searchArtist } from "../lastfm.ts";

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
	if (args.length !== 0) {
		const searchResults = await searchArtist(args.join(" "));
		if (searchResults) {
			artist = searchResults[0]?.name;
		}
	}
	if (artist === "") {
		const lastTrack = await getRecentTracks(lastfm.lastfm, 1);
		if (!lastTrack?.[0])
			return client.sendMessage(roomId, {
				msgtype: "m.text",
				body: "couldn't fetch recent tracks",
			});
		artist = lastTrack[0].artist;
	}

	const artistInfo = await getArtist(artist, lastfm.lastfm);
	if (!artistInfo)
		return client.sendMessage(roomId, {
			msgtype: "m.text",
			body: "couldn't fetch artist info",
		});
	client.sendMessage(roomId, {
		msgtype: "m.text",
		format: "org.matrix.custom.html",
		body: `${message.sender} has listened to \`${artistInfo.name}\` ${artistInfo.plays === "1" ? "once" : `${artistInfo.plays || 0} times`}`,
		mentions: {
			user_ids: [message.sender],
		},
		formatted_body: `<a href="https://matrix.to/#/${message.sender}">${message.sender.split(":")[0]}</a> has listened to \`${artistInfo.name}\` ${artistInfo.plays === "1" ? "once" : `${artistInfo.plays || 0} times`}`,
	});
}
