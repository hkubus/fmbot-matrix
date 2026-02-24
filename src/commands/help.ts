import { execSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import type { Client } from "stanza";
import type { Message } from "stanza/protocol";
import { reply } from "../index.ts";

const commands = (await readdir("./src/commands")).map(
	(file) => file.split(".")[0],
);
const commit = execSync("git rev-parse --short HEAD").toString().trim();

export async function run(_client: Client, message: Message) {
	if (!message.from) return;
	const [, nickname] = message.from.split("/");
	reply(message, {
		body: `available commands:\n.${commands.join(", .")}\ncurrent commit: ${commit}`,
	});
}
