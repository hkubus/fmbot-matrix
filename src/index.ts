import { readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import * as sdk from "@vector-im/matrix-bot-sdk";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";

dayjs.extend(relativeTime);

if (
	!process.env.MATRIX_INSTANCE ||
	!process.env.MATRIX_USER ||
	!process.env.MATRIX_PASSWORD ||
	!process.env.MATRIX_ACCESS_TOKEN
) {
	console.log("missing env keys");
	process.exit();
}
const crypto = new sdk.RustSdkCryptoStorageProvider("crypto", 0);
const storage = new sdk.SimpleFsStorageProvider("matrix.json");
const client = new sdk.MatrixClient(
	process.env.MATRIX_INSTANCE,
	process.env.MATRIX_ACCESS_TOKEN,
	storage,
	crypto,
);
crypto.getDeviceId();

sdk.AutojoinRoomsMixin.setupOnClient(client);
const db = new DatabaseSync("db.sqlite3");
db.prepare(
	`CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, lastfm TEXT)`,
).run();

const commands = new Map();
const dir = await readdir(`${import.meta.dirname}/commands`);
dir.forEach(async (e) => {
	const cmd = await import(`${import.meta.dirname}/commands/${e}`);
	commands.set(e.split(".")[0], cmd);
});

client.on(
	"room.message",
	async (
		roomId: string,
		event: sdk.MessageEvent<
			sdk.MessageEventContent & { "m.mentions": { user_ids: string[] } }
		>,
	) => {
		if (event.sender === (await client.getUserId())) return;
		if (event.content?.msgtype !== "m.text") return;
		const body = event.content?.body;
		if (
			event.content["m.mentions"]?.user_ids?.includes(await client.getUserId())
		) {
			const command = commands.get("help");
			command?.run(client, event, roomId, db);
			return;
		}
		if (body.startsWith(".")) {
			const commandName = body.slice(1).split(" ")[0];
			const command = commands.get(commandName);
			if (command) {
				command.run(client, event, roomId, db);
			}
		}
	},
);

client.start().then(() => console.log("Bot started!"));
