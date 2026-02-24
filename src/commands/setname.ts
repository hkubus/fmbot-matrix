import type { Database } from "better-sqlite3";
import type { Client } from "stanza";
import type { Message } from "stanza/protocol";
import { reply } from "../index.ts";
import { getUserInfo } from "../lastfm.ts";

export async function run(_client: Client, message: Message, db: Database) {
	if (!message.from) return;
	const [, nickname] = message.from.split("/");
	const name = message.body?.slice("!setname".length + 1);
	if (!name) return reply(message, { body: "provide a name" });
	const user = await getUserInfo(name);
	if (!user) return reply(message, { body: "invalid username lol!" });
	db.prepare(
		"INSERT INTO users (name, lastfm) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET lastfm = excluded.lastfm",
	).run(nickname, name);
	reply(message, {
		body: `set your username to ${user.name} with ${user?.playcount} play count`,
	});
}
