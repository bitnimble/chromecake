import * as http from 'http';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as findProcess from 'find-process';
import * as tempWrite from 'temp-write';


export class StreamServer {
	ffmpeg: child_process.ChildProcess;
	httpServer: http.Server;

	constructor(private port: number, private file: string, private avsTemplate: string, private enhance: boolean = false) {
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

	hasSubs(file: string) {
		let result = child_process.spawnSync("ffprobe", [
			"-v", "error",
			"-select_streams", "s:0",
			"-show_entries", "stream=codec_name",
			"-of", "csv=p=0",
			file
		]);
		const subs = String(result.stdout).trim()
		console.log(subs);
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
		console.log(codec);
		return codec !== '' && codec !== 'png' && codec !== 'jpg';
	}

	needsAudioEncode(file) {
		return true;
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
					"-i", avs
				];
			} else {
				finalOptions = [
					"-i", this.file
				];
			}
			
			const needsVideoEncode = this.needsVideoEncode(this.file);
			if (needsVideoEncode) {
				finalOptions = finalOptions.concat([
					// "-c:v", "libx265",
					// "-crf", "15"
					"-c:v", "hevc_nvenc",
					"-preset", "llhq",
					"-rc", "constqp",
					"-qp", "15"
				]);
			} else {
				finalOptions = finalOptions.concat([
					"-vn"
				]);
			}
			if (this.needsAudioEncode(this.file)) {
				finalOptions = finalOptions.concat([
					"-c:a", "ac3",
					"-b:a", "320k"
				]);
			}
			if (needsVideoEncode && this.hasSubs(this.file)) {
				finalOptions = finalOptions.concat([
					"-vf", "subtitles=" + this.escapeFfmpeg(this.file)
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
			req.on('close', () => this.kill());
			req.on('end', () => this.kill());
		});
		this.httpServer.listen(this.port);
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
