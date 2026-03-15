import type { DatabaseSync } from "node:sqlite";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";
import { getUserInfo } from "../lastfm.ts";

export async function run(
	client: MatrixClient,
	message: MessageEvent<MessageEventContent>,
	roomId: string,
	db: DatabaseSync,
) {
	const name = message.content.body?.slice("!setname".length + 1);
	if (!name) return client.replyText(roomId, message.eventId, "provide a name");
	const user = await getUserInfo(name);
	if (!user)
		return client.replyText(roomId, message.eventId, "invalid username lol!");
	db.prepare(
		"INSERT INTO users (name, lastfm) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET lastfm = excluded.lastfm",
	).run(message.sender, name);
	client.replyText(
		roomId,
		message.eventId,
		`set your username to ${user.name} with ${user?.playcount} play count`,
	);
}
