const apiKey = process.env.LAST_FM_KEY as string;
export interface Track {
	artist: string;
	image: string;
	album: string;
	nowPlaying: boolean;
	title: string;
	url: string;
	date: Date;
	artistMbid: string;
}
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
	const data: Track[] = [];
	const json = await req.json();
	// biome-ignore lint/suspicious/noExplicitAny: b
	json.recenttracks.track.forEach((e: any) => {
		data.push({
			artist: e.artist["#text"],
			image:
				e.image[3]["#text"] ||
				e.image.at(-1)?.["#text"] ||
				"https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png",
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

export async function getTrack(track: string, artist: string, user: string) {
	const req = await fetch(
		`https://ws.audioscrobbler.com/2.0/?method=track.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(
			artist,
		)}&track=${encodeURIComponent(track)}&user=${user}&format=json`,
	);
	if (req.status !== 200) return null;
	const json = await req.json();
	if (!json.track) return null;
	const e = json.track;
	return {
		artist: e.artist.name,
		image:
			e.album?.image[3]["#text"] ||
			e.album?.image.at(-1)?.["#text"] ||
			"https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png",
		album: e.album?.title,
		title: e.name,
		url: e.url,
		duration: parseInt(e.duration, 10),
		artistMbid: e.artist.mbid,
		plays: e.userplaycount,
	};
}

export async function searchTrack(trackName: string): Promise<
	| {
			artist: string;
			title: string;
			url: string;
			image: string;
	  }[]
	| null
> {
	let artist = "";
	if (trackName.includes("-")) {
		[artist, trackName] = trackName.split("-").map((e) => e.trim());
	}
	const req = await fetch(
		`https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(
			trackName,
		)}&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json`,
	);
	if (req.status !== 200) return null;
	const json = await req.json();
	return json.results.trackmatches.track.map((e: any) => ({
		artist: e.artist,
		title: e.name,
		url: e.url,
		image:
			e.image[3]["#text"] ||
			e.image.at(-1)?.["#text"] ||
			"https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png",
	}));
}

export async function searchArtist(artistName: string): Promise<
	| {
			name: string;
			url: string;
			image: string;
	  }[]
	| null
> {
	const req = await fetch(
		`https://ws.audioscrobbler.com/2.0/?method=artist.search&artist=${encodeURIComponent(
			artistName,
		)}&api_key=${apiKey}&format=json`,
	);
	if (req.status !== 200) return null;
	const json = await req.json();
	return json.results.artistmatches.artist.map((e: any) => ({
		name: e.name,
		url: e.url,
		image:
			e.image[3]["#text"] ||
			e.image.at(-1)?.["#text"] ||
			"https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png",
	}));
}

export async function getArtist(artist: string, user: string) {
	const req = await fetch(
		`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(
			artist,
		)}&user=${user}&format=json`,
	);
	if (req.status !== 200) return null;
	const json = await req.json();
	if (!json.artist) return null;
	const e = json.artist;
	return {
		name: e.name,
		image:
			e.image[3]["#text"] ||
			e.image.at(-1)?.["#text"] ||
			"https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png",
		url: e.url,
		summary: e.bio?.summary || "",
		plays: e.stats.userplaycount,
	};
}

export async function searchAlbum(albumName: string): Promise<
	| {
			artist: string;
			title: string;
			url: string;
			image: string;
	  }[]
	| null
> {
	const req = await fetch(
		`https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(
			albumName,
		)}&api_key=${apiKey}&format=json`,
	);
	if (req.status !== 200) return null;
	const json = await req.json();
	return json.results.albummatches.album.map((e: any) => ({
		artist: e.artist,
		title: e.name,
		url: e.url,
		image:
			e.image[3]["#text"] ||
			e.image.at(-1)?.["#text"] ||
			"https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png",
	}));
}
export async function getAlbum(album: string, artist: string, user: string) {
	const req = await fetch(
		`https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(
			artist,
		)}&album=${encodeURIComponent(album)}&user=${user}&format=json`,
	);
	if (req.status !== 200) return null;
	const json = await req.json();
	if (!json.album) return null;
	const e = json.album;
	return {
		artist: e.artist,
		title: e.name,
		image:
			e.image[3]["#text"] ||
			e.image.at(-1)?.["#text"] ||
			"https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png",
		url: e.url,
		summary: e.wiki?.summary || "",
		plays: e.userplaycount,
	};
}
