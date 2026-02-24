import type { Database } from "better-sqlite3";
import type { Client } from "stanza";
import type { Message } from "stanza/protocol";
import { reply } from "../index.ts";
import { getArtist, getRecentTracks, searchArtist } from "../lastfm.ts";

export async function run(_client: Client, message: Message, db: Database) {
	if (!message.from) return;
	const [, nickname] = message.from.split("/");
	const args = message.body?.split(" ").slice(1) || [];
	const lastfm = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(nickname) as { lastfm: string };

	let artist = "";
	if (args.length !== 0) {
		const searchResults = await searchArtist(args.join(" "));
		if (searchResults) {
			artist = searchResults[0].name;
		}
	} else {
		const lastTrack = await getRecentTracks(lastfm.lastfm, 1);
		if (!lastTrack?.[0])
			return reply(message, { body: "couldn't fetch recent tracks" });
		artist = lastTrack[0].artist;
	}
	const artistInfo = await getArtist(artist, lastfm.lastfm);
	if (!artistInfo)
		return reply(message, { body: "couldn't fetch artist info" });
	reply(message, {
		body: `${nickname} has listened to \`${artistInfo.name}\` ${artistInfo.plays === "1" ? "once" : `${artistInfo.plays} times`}`,
	});
}
