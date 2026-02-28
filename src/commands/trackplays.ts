import type { DatabaseSync } from "node:sqlite";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";
import { getRecentTracks, getTrack, searchTrack } from "../lastfm.ts";

export async function run(
	client: MatrixClient,
	message: MessageEvent<MessageEventContent>,
	roomId: string,
	db: DatabaseSync,
) {
	const args = message.content?.body?.split(" ").slice(1) || [];
	const lastfm = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(message.sender) as { lastfm: string };

	const track: { title: string; artist: string } = { title: "", artist: "" };

	if (args.length !== 0) {
		const searchResults = await searchTrack(args.join(" "));
		if (searchResults) {
			const result = searchResults[0];
			track.title = result.title;
			track.artist = result.artist;
		}
	}

	const currentTrack: { title: string; artist: string }[] | null =
		track.title !== "" ? [track] : await getRecentTracks(lastfm.lastfm, 1);
	if (!currentTrack?.[0])
		return client.sendMessage(roomId, {
			msgtype: "m.text",
			body: "couldn't fetch recent tracks",
		});
	const trackInfo = await getTrack(
		currentTrack[0].title,
		currentTrack[0].artist,
		lastfm.lastfm,
	);

	if (!trackInfo)
		return client.sendMessage(roomId, {
			msgtype: "m.text",
			body: "couldn't fetch track info",
		});
	console.log(trackInfo);
	client.sendMessage(roomId, {
		msgtype: "m.text",
		format: "org.matrix.custom.html",
		body: `${message.sender} has listened to \`${trackInfo.artist} - ${trackInfo.title}\` ${trackInfo.plays === "1" ? "once" : `${trackInfo.plays || 0} times`}`,
		mentions: {
			user_ids: [message.sender],
		},
		formatted_body: `<a href="https://matrix.to/#/${message.sender}">${message.sender.split(":")[0]}</a> has listened to \`${trackInfo.artist} - ${trackInfo.title}\` ${trackInfo.plays === "1" ? "once" : `${trackInfo.plays || 0} times`}`,
	});
}
