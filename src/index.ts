import "dotenv/config";
import { exec } from "node:child_process";
import { exists, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import Database from "better-sqlite3";
import * as XMPP from "stanza";
import type { Message } from "stanza/protocol";
import { WebSocketServer } from "ws";

if (
	!process.env.TRANSPORT_WS ||
	!process.env.TRANSPORT_BOSH ||
	!process.env.XMPP_ROOM
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
// need both to account for one getting the message before the other
const messagesWs: Record<string, string> = {};
const messagesBot: Record<string, Message> = {};
const ws = new WebSocketServer({ port: 8080 });
ws.on("connection", (ws) => {
	ws.on("message", (e) => {
		const body: { type: string; id: string; body: string } = JSON.parse(
			e.toString(),
		);
		if (!messagesBot[body.id]) messagesWs[body.id] = body.body;
		else {
			const msg = messagesBot[body.id];
			msg.body = body.body;
			messageHandle(msg);
			delete messagesBot[body.id];
		}
	});
	ws.on("error", console.error);
});
// python bridge for omemo Lol
exec(
	existsSync("./venv")
		? "./venv/bin/python src/bridge.py"
		: "python src/bridge.py",
	{
		env: process.env,
	},
	(e, stdout, stderr) => {
		console.log({ e, stdout, stderr });
	},
);
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
	client.joinRoom(process.env.XMPP_ROOM, "fmbot", {});
});

const messageHandle = (msg: Message) => {
	// console.log(msg);
	if (!msg.from) return;
	const [, nickname] = msg.from.split("/");
	if (nickname === "fmbot") return;

	if (msg.delay?.timestamp.getTime()) return;
	if (!msg.body?.startsWith(".")) return;

	const command = commands.get(msg.body.slice(1).split(" ")[0]);
	command.run(client, msg, db);
};

client.on("groupchat", (e) => {
	if (!e.omemo) return messageHandle(e);
	if (!e.id) return;
	if (!messagesWs[e.id]) messagesBot[e.id] = e;
	else {
		e.body = messagesWs[e.id];
		messageHandle(e);
		delete messagesWs[e.id];
	}
});

client.on("chat", messageHandle);

client.connect();

export function reply(msg: Message, args: Message) {
	client.sendMessage({
		...args,
		to: msg.from?.split("/")[0],
		type: "groupchat",
	});
}
