import * as chromecastPlayer from 'chromecast-player';
import * as internalIp from 'internal-ip';
import { StreamServerQueue } from './stream_server_queue';
import * as fs from 'fs';
import * as path from 'path';

const port = 9020;
const player = chromecastPlayer();

if (process.argv.length < 3) {
	console.log('Not enough arguments. Please supply a path.');
	process.exit(1);
}
const media = process.argv[2];
let paused = false;
let files = [];
if (fs.statSync(media).isDirectory()) {
	files = fs.readdirSync(media).filter(entry =>
		entry.endsWith('.mkv')
		|| entry.endsWith('.mp4')
		|| entry.endsWith('.mp3')
		|| entry.endsWith('.ogg'));
	files = files.map(f => media + '/' + f);
} else {
	files = [media];
}
console.log(files);

const avsTemplate = String(fs.readFileSync(path.join(__dirname, 'template.avs')));

let serverQueue = new StreamServerQueue(port, avsTemplate);
serverQueue.push(...files);
serverQueue.playNext();

const rl = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
});

rl.on('SIGINT', () => process.emit('SIGINT'));

internalIp.v4().then(ip => {
	const address = `http://${ip}:${port}/video.mp4`;
	function chromecastPlay() {
		player.launch(address, function (err, p) {
			process.on('SIGINT', () => {
				p.stop();
				process.exit();
			});

			if (err) console.log(err);

			p.once('playing', () => {
				console.log('Playback has started.');
				paused = false;
			});

			p.on('status', async s => {
				console.log(s);
				if (s.playerState === 'IDLE' && s.idleReason === 'FINISHED') {
					await serverQueue.playNext() ? chromecastPlay() : process.exit(0);
				}
			});

			process.stdin.setRawMode(true);
			process.stdin.on('data', async d => {
				if (String(d) === ' ') {
					if (paused) {
						p.play();
						paused = false;
					} else {
						p.pause();
						paused = true;
					}
				} else if (String(d) === 'n') {
					await serverQueue.playNext() ? chromecastPlay() : process.exit(0);
				}
			});
		});
	}

	chromecastPlay();
});
