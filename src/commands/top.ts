import type { DatabaseSync } from "node:sqlite";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";

export async function run(
	client: MatrixClient,
	message: MessageEvent<
		MessageEventContent & { "m.mentions"?: { user_ids?: string[] } }
	>,
	roomId: string,
	db: DatabaseSync,
) {
	const args = message.content.body.split(" ");
	const type = args.pop() || "";
	if (!["artists", "tracks", "albums"].includes(type))
		return client.sendMessage(roomId, {
			msgtype: "m.text",
			body: `invalid type of top`,
		});
	const valid = ["overall", "7day", "1month", "3month", "6month", "12month"];
	const time = args.filter((e) => valid.includes(e))[0] || "7day";
	const name = message.sender;
	const result = db
		.prepare("SELECT lastfm, style FROM users WHERE name = ?")
		.get(name) as { lastfm: string; style: number };
	const lastfm = result?.lastfm;
	const mention = message.content?.["m.mentions"]?.user_ids?.[0];
	const user: { lastfm: string; style: number } | null = mention
		? (db
				.prepare("SELECT lastfm, style FROM users WHERE name = ?")
				.get(mention) as {
				lastfm: string;
				style: number;
			})
		: null;
	const username = user ? user.lastfm : lastfm;
	const req = await fetch(
		`http://ws.audioscrobbler.com/2.0/?method=user.gettop${type}&period=${time}&user=${username}&api_key=${process.env.LAST_FM_KEY}&limit=10&format=json`,
	);
	const body = (await req.json()) as Record<string, any>;
	let results: any[] = [];
	switch (type) {
		case "artists":
			results = body.topartists.artist.sort((e: any) => e["@attr"].rank);
			break;
		case "tracks":
			results = body.toptracks.track.sort((e: any) => e["@attr"].rank);
			break;
		case "albums":
			results = body.topalbums.album.sort((e: any) => e["@attr"].rank);
			break;
	}
	results.map((e) => {
		e.name = e.name.slice(0, e.name.toLowerCase().split("(feat")[0].length);
		return e;
	});
	const longestArtist =
		type === "artists"
			? 0
			: Math.max(...results.map((e) => e.artist.name.length));
	const longestName = Math.max(...results.map((e) => e.name.length));
	client.sendMessage(roomId, {
		msgtype: "m.text",
		body: `Top ${type} for ${username}
		${results.map((e: any) => `${e["@attr"].rank}. ${type === "artists" ? "" : e.artist.name.padEnd(longestArtist, " ")} - ${e.name} - ${e.playcount} scrobbles`).join("\n")}\n`,
		format: "org.matrix.custom.html",
		formatted_body: `Top ${type} for ${username}${results.map((e: any) => `<br><code>${e["@attr"].rank.toString().padStart(2, " ")}. ${type === "artists" ? "" : e.artist.name.padEnd(longestArtist, " ")} - ${e.name.padEnd(longestName)} - ${e.playcount} scrobbles`).join("</code>")}`,
	});
}
