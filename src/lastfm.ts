const apiKey = process.env.LAST_FM_KEY as string;

export async function getUserInfo(name: string) {
	const req = await fetch(
		`http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${name}&api_key=${apiKey}&format=json`,
	);
	if (req.status !== 200) return null;
	const { user } = await req.json();
	return {
		name: user.name,
		playcount: parseInt(user.playcount, 10),
		trackCount: parseInt(user.track_count, 10),
		albumCount: parseInt(user.album_count, 10),
		artistCount: parseInt(user.artist_count, 10),
	};
}
export async function getRecentTracks(name: string, limit?: number) {
	const req = await fetch(
		`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${name}&api_key=${apiKey}${limit ? `&limit=${limit}` : ``}&format=json`,
	);
	if (req.status !== 200) return null;
	const data: {
		artist: string;
		image: string;
		album: string;
		nowPlaying: boolean;
		title: string;
		url: string;
		date: Date;
		artistMbid: string;
	}[] = [];
	const json = await req.json();
	// biome-ignore lint/suspicious/noExplicitAny: b
	json.recenttracks.track.forEach((e: any) => {
		console.log(e.artist);
		data.push({
			artist: e.artist["#text"],
			image: e.image[3]["#text"],
			album: e.album["#text"],
			nowPlaying: e["@attr"]?.nowplaying === "true",
			title: e.name,
			url: e.url,
			date: e.date ? new Date(parseInt(e.date.uts, 10) * 1000) : new Date(),
			artistMbid: e.artist.mbid,
		});
	});
	return data;
}
