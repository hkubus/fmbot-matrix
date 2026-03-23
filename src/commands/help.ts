import { execSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";

const commands = (await readdir("./src/commands")).map(
	(file) => file.split(".")[0],
);
const commit = execSync("git rev-parse --short HEAD").toString().trim();

export async function run(
	client: MatrixClient,
	_message: MessageEvent<MessageEventContent>,
	roomId: string,
) {
	client.sendMessage(roomId, {
		msgtype: "m.text",
		body: `available commands:\n.${commands.join(", .")}\ncurrent commit: ${commit}`,
	});
}
