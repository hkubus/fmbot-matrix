import type { DatabaseSync } from "node:sqlite";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";

export async function run(
	client: MatrixClient,
	message: MessageEvent<MessageEventContent>,
	roomId: string,
	db: DatabaseSync,
) {
	const current = db
		.prepare("SELECT style FROM users WHERE name = ?")
		.get(message.sender);

	if (!current)
		return client.sendMessage(roomId, {
			msgType: "m.text",
		});

	db.prepare(
		"UPDATE users SET style = CASE WHEN style = 0 THEN 1 ELSE 0 END WHERE name = ?",
	).run(message.sender);

	client.sendMessage(roomId, {
		msgtype: "m.text",
		body: `changed your style to ${current?.style ? "solid" : "blur"}`,
	});
}
