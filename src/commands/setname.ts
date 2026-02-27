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
	if (!name)
		return client.sendMessage(roomId, {
			msgtype: "m.text",
			body: "provide a name",
		});
	const user = await getUserInfo(name);
	if (!user)
		return client.sendMessage(roomId, {
			msgtype: "m.text",
			body: "invalid username lol!",
		});
	db.prepare(
		"INSERT INTO users (name, lastfm) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET lastfm = excluded.lastfm",
	).run(message.sender, name);
	client.sendMessage(roomId, {
		msgtype: "m.text",
		body: `set your username to ${user.name} with ${user?.playcount} play count`,
	});
}
