import type { DatabaseSync } from "node:sqlite";
import type {
	MatrixClient,
	MessageEvent,
	MessageEventContent,
} from "@vector-im/matrix-bot-sdk";
import { getRecentTracks } from "../lastfm.ts";

export async function run(
	client: MatrixClient,
	message: MessageEvent<
		MessageEventContent & { "m.mentions"?: { user_ids?: string[] } }
	>,
	roomId: string,
	db: DatabaseSync,
) {
	const name = message.sender;
	const result = db
		.prepare("SELECT lastfm FROM users WHERE name = ?")
		.get(name) as { lastfm: string };
	let lastfm = result?.lastfm;
	const mention = message.content?.["m.mentions"]?.user_ids?.[0];
	const user: { lastfm: string } | null = mention
		? (db.prepare("SELECT lastfm FROM users WHERE name = ?").get(mention) as {
				lastfm: string;
			})
		: null;
	if (!lastfm && !user?.lastfm)
		return client.sendMessage(roomId, {
			body: "you need to set your lastfm account with .setname <lastfm>",
		});

	if (user?.lastfm) lastfm = user?.lastfm;
	let tracks = await getRecentTracks(user?.lastfm || lastfm, 2);
	if (!tracks) tracks = await getRecentTracks(lastfm, 2);
	if (!tracks)
		return client.sendMessage(roomId, {
			body: "couldnt fetch recent tracks",
		});

	if (
		tracks[0].image !==
		"https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png" // default image used when none found
	) {
		const albumimage = tracks[0].image.split("/").at(-1); // to get the full size image (without the /300x300/ in the url)
		try {
			const response = await fetch(
				`https://lastfm.freetls.fastly.net/i/u/${albumimage}`,
			);
			if (!response.ok) {
				throw new Error(`Could not download album cover: ${response.status}`);
			}
			const buffer = Buffer.from(await response.arrayBuffer());
			const encrypted = await client.crypto.encryptMedia(buffer);
			const mxc = await client.uploadContent(encrypted.buffer);
			await client.sendMessage(roomId, {
				body: "image.png",
				msgtype: "m.image",
				info: {
					mimetype: "image/png",
					size: buffer.length,
				},
				file: {
					url: mxc,
					...encrypted.file,
				},
			});
			// biome-ignore lint/suspicious/noExplicitAny: error type must be any or unknown
		} catch (error: any) {
			if (error.message) {
				client.sendMessage(roomId, {
					msgtype: "m.text",
					body: `${error.message}`,
				});
			}
		}
	} else {
		if (tracks[0].album === "") {
			client.sendMessage(roomId, {
				msgtype: "m.text",
				body: `Track \`${tracks[0].title}\` by \`${tracks[0].artist}\` has no associated cover`,
			});
		} else {
			client.sendMessage(roomId, {
				msgtype: "m.text",
				body: `Album \`${tracks[0].album}\` by \`${tracks[0].artist}\` has no associated cover`,
			});
		}
	}
}
