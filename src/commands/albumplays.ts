import type { Database } from "better-sqlite3";
import type { Client } from "stanza";
import type { Message } from "stanza/protocol";
import { reply } from "../index.ts";
import { getAlbum, getRecentTracks, searchAlbum } from "../lastfm.ts";

export async function run(_client: Client, message: Message, db: Database) {
	if (!message.from) return;
	const [, nickname] = message.from.split("/");
	const args = message.body?.split(" ").slice(1) || [];
	const lastfm = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(nickname) as { lastfm: string };

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
			return reply(message, { body: "couldn't fetch recent tracks" });
		artist = lastTrack[0].artist;
		album = lastTrack[0].album;
	}
	const albumInfo = await getAlbum(album, artist, lastfm.lastfm);
	if (!albumInfo) return reply(message, { body: "couldn't fetch album info" });
	reply(message, {
		body: `${nickname} has listened to \`${albumInfo.title}\` by ${albumInfo.artist} ${albumInfo.plays === "1" ? "once" : `${albumInfo.plays} times`}`,
	});
}
