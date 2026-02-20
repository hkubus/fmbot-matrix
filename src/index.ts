import "dotenv/config";
import { readdir } from "node:fs/promises";
import Database from "better-sqlite3";
import * as XMPP from "stanza";
import type { Message } from "stanza/protocol";

if (
	!process.env.TRANSPORT_WS ||
	!process.env.TRANSPORT_BOSH ||
	!process.env.ROOM
) {
	console.log("missing env keys");
	process.exit();
}
const client = XMPP.createClient({
	jid: process.env.XMPP_USER,
	password: process.env.XMPP_PASSWORD,

	transports: {
		websocket: process.env.TRANSPORT_WS,
		bosh: process.env.TRANSPORT_BOSH,
	},
});
const db = new Database("db.sqlite3");
db.prepare(
	`CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, lastfm TEXT)`,
).run();
const commands = new Map();
const dir = await readdir(`${import.meta.dirname}/commands`);
dir.forEach(async (e) => {
	console.log(`${import.meta.dirname}/commands/${e}`);
	const cmd = await import(`${import.meta.dirname}/commands/${e}`);
	commands.set(e.split(".")[0], cmd);
});

client.on("session:started", async () => {
	client.sendPresence();
	console.log("Started");
	// @ts-expect-error It exists
	client.joinRoom(process.env.ROOM, "fmbot", {});
});

const messageHandle = (msg: Message) => {
	if (!msg.from) return;
	const [, nickname] = msg.from.split("/");
	if (nickname === "fmbot") return;

	if (msg.delay?.timestamp.getTime()) return;
	if (!msg.body?.startsWith(".")) return;

	const command = commands.get(msg.body.slice(1).split(" ")[0]);
	command.run(client, msg, db);
};

client.on("groupchat", messageHandle);
client.on("chat", messageHandle);

client.connect();

export function reply(msg: Message, args: Message) {
	client.sendMessage({
		...args,
		to: msg.from?.split("/")[0],
		type: "groupchat",
	});
}
