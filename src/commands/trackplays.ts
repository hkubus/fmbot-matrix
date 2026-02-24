import type { Database } from "better-sqlite3";
import type { Client } from "stanza";
import type { Message } from "stanza/protocol";
import { reply } from "../index.ts";
import { getRecentTracks, getTrack, searchTrack } from "../lastfm.ts";

export async function run(_client: Client, message: Message, db: Database) {
	if (!message.from) return;
	const [, nickname] = message.from.split("/");
	const args = message.body?.split(" ").slice(1) || [];
	const lastfm = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(nickname) as { lastfm: string };

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
		return reply(message, { body: "couldn't fetch recent tracks" });
	const trackInfo = await getTrack(
		currentTrack[0].title,
		currentTrack[0].artist,
		lastfm.lastfm,
	);

	if (!trackInfo) return reply(message, { body: "couldn't fetch track info" });
	reply(message, {
		body: `${nickname} has listened to \`${trackInfo.artist} - ${trackInfo.title}\` ${trackInfo.plays === "1" ? "once" : `${trackInfo.plays} times`}`,
	});
}
