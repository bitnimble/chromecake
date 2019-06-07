import * as http from 'http';
import * as child_process from 'child_process';
import * as tempWrite from 'temp-write';

type SubtitleTags = {
	title: string;
	language: string;
};

type SubtitleTrack = {
	index: number;
	subIndex: number;
	tags: SubtitleTags;
};

type SubList = {
	streams: SubtitleTrack[];
};

export class StreamServer {
	ffmpeg: child_process.ChildProcess;
	httpServer: http.Server;

	constructor(private port: number, private file: string, private avsTemplate: string, private enhance: boolean, private position: number = 0) {
	}

	escapeFfmpeg(input: string) {
		return input.split("\\").join("\\\\\\\\")
			.split(":").join("\\\\\\:")
			.split(",").join("\\\\\\,")
			.split("[").join("\\\\\\[")
			.split("]").join("\\\\\\]")
			.split("'").join("\\\\\\'")
			.split(" ").join("\\\\\\ ");
	}

	lowerContains(s: string, compare: string) {
		if (!s) {
			return false;
		}
		return s.toLowerCase().indexOf(compare) !== -1;
	}

	getEnglishSubIndex(file: string) {
		const result = child_process.spawnSync("ffprobe", [
			"-v", "error",
			"-select_streams", "s",
			"-show_entries", "stream=index:stream_tags=title,language",
			"-of", "json",
			file
		]);
		const subs = JSON.parse(String(result.stdout).trim()) as SubList;
		subs.streams = subs.streams.sort((a, b) => a.index - b.index);
		for (let i = 0; i < subs.streams.length; i++) {
			subs.streams[i].subIndex = i;
		}
		const englishTracks = subs.streams.filter(sub => this.lowerContains(sub.tags.title, 'english') || this.lowerContains(sub.tags.language, 'english'));
		if (englishTracks.length > 0) {
			return englishTracks[0].subIndex;
		}
		const engTracks = subs.streams.filter(sub => this.lowerContains(sub.tags.title, 'eng') || this.lowerContains(sub.tags.language, 'eng'));
		if (engTracks.length > 0) {
			return engTracks[0].subIndex;
		}
		return 0;
	}

	getSubType(file: string) {
		const result = child_process.spawnSync("ffprobe", [
			"-v", "error",
			"-select_streams", "s:0",
			"-show_entries", "stream=codec_name",
			"-of", "csv=p=0",
			file
		]);
		return String(result.stdout).trim();
	}

	hasImageSubs(file: string) {
		const subs = this.getSubType(file);
		console.log(subs);
		// TODO: find what the normal vobsub type is
		return subs === 'hdmv_pgs_subtitle';
	}

	hasTextSubs(file: string) {
		const subs = this.getSubType(file);
		console.log(`Subtitle format: ${subs}`);
		return subs !== '' && subs !== 'hdmv_pgs_subtitle';
	}

	needsVideoEncode(file) {
		let result = child_process.spawnSync("ffprobe", [
			"-v", "error",
			"-select_streams", "v:0",
			"-show_entries", "stream=codec_name",
			"-of", "default=noprint_wrappers=1:nokey=1",
			file
		]);
		const codec = String(result.stdout).trim();
		console.log(`Video codec: ${codec}`);
		return codec !== '' && codec !== 'png' && codec !== 'jpg' && codec !== 'hevc';
	}

	needsAudioEncode(file) {
		let result = child_process.spawnSync("ffprobe", [
			"-v", "error",
			"-select_streams", "a:0",
			"-show_entries", "stream=codec_name",
			"-of", "default=noprint_wrappers=1:nokey=1",
			file
		]);
		const codec = String(result.stdout).trim();
		console.log(`Audio codec: ${codec}`);
		return codec !== '' && codec !== 'dts';
	}

	createAvsFile(file): string {
		const avs = this.avsTemplate.replace('{0}', file);
		const filepath = tempWrite.sync(avs, '.avs');
		return filepath;
	}

	start() {
		if (this.httpServer) {
			return;
		}

		this.httpServer = http.createServer((req, res) => {
			if (this.ffmpeg) {
				return;
			}
			console.log('Request received');
			res.writeHead(200, {
				'Access-Control-Allow-Origin': '*',
				'Content-Type': 'video/mp4',
				'Connection': 'Keep-Alive'
			});

			let finalOptions;
			if (this.enhance) {
				const avs = this.createAvsFile(this.file);
				console.log(avs);

				finalOptions = [
					"-hwaccel", "cuvid",
					"-i", avs
				];
			} else {
				finalOptions = [
					"-hwaccel", "cuvid",
					"-i", this.file
				];
			}

			const hasImageSubs = this.hasImageSubs(this.file);
			const hasTextSubs = this.hasTextSubs(this.file);
			const needsVideoEncode = hasImageSubs || hasTextSubs || this.needsVideoEncode(this.file);

			if (hasImageSubs) {
				finalOptions = finalOptions.concat([
					"-filter_complex", "[0:v][0:s]overlay[v]",
					"-map", "[v]",
					"-map", "0:a"
				]);
			}

			if (needsVideoEncode) {
				finalOptions = finalOptions.concat([
					//"-filter:v", "scale_npp=w=1920:h=1080:format=yuv444p16:interp_algo=lanczos",
					"-c:v", "hevc_nvenc",
					"-pix_fmt", "p010le",
					"-profile:v", "main10",
					"-preset", "hq",
					"-rc", "vbr_hq",
					"-qmin:v", "16",
					"-qmax:v", "12",
					"-rc-lookahead", "32",
					"-maxrate:v", "100M",
				]);
			} else {
				finalOptions = finalOptions.concat([
					"-c:v", "copy"
				]);
			}
			if (this.needsAudioEncode(this.file)) {
				finalOptions = finalOptions.concat([
					"-c:a", "aac",
					"-b:a", "320k"
				]);
			}
			if (hasTextSubs) {
				const engSubIndex = this.getEnglishSubIndex(this.file);
				console.log("English sub index: " + engSubIndex);
				finalOptions = finalOptions.concat([
					"-vf", "subtitles=" + this.escapeFfmpeg(this.file) + ":si=" + engSubIndex,
				]);
			}

			finalOptions = finalOptions.concat([
				"-f", "matroska",
				"-movflags", "frag_keyframe",
				"pipe:1"
			]);

			console.log('ffmpeg ' + finalOptions.join(' '));
			this.ffmpeg = child_process.spawn('ffmpeg', finalOptions);
			this.ffmpeg.stdout.pipe(res);
			this.ffmpeg.stderr.setEncoding('utf8');
			this.ffmpeg.stderr.on('data', data => {
				console.log(data);
			});
			req.on('close', () => this.restart());
			req.on('end', () => this.restart());
		});
		this.httpServer.listen(this.port);
	}

	async restart() {
		await this.kill();
		this.start();
	}

	kill(): Promise<void> {
		if (!this.httpServer) return Promise.resolve();

		return new Promise(resolve => {
			this.ffmpeg && this.ffmpeg.kill('SIGINT');
			this.httpServer.close(() => {
				resolve();
			});
		});
	}
}
