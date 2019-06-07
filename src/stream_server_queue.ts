import { StreamServer } from './stream_server';

export class StreamServerQueue {
	currentStreamServer: StreamServer;
	queue: string[] = [];

	constructor(private port: number, private avsTemplate: string, private enhance: boolean) { }

	push(...filepaths: string[]) {
		this.queue.push(...filepaths);
	}

	async playNext() {
		await this.stop();

		const nextMedia = this.queue.shift();
		if (!nextMedia) {
			console.log('No more media in the queue!');
			return false;
		}
		console.log(`Playing ${nextMedia}`);
		this.currentStreamServer = new StreamServer(this.port, nextMedia, this.avsTemplate, this.enhance);
		this.currentStreamServer.start();
		return true;
	}

	async seek(position) {
		await this.stop();
		const currentMedia = this.queue[0];
		this.currentStreamServer = new StreamServer(this.port, currentMedia, this.avsTemplate, this.enhance);
		this.currentStreamServer.start();
		return true;
	}

	stop() {
		if (this.currentStreamServer) {
			return this.currentStreamServer.kill();
		}
		return Promise.resolve();
	}
}
