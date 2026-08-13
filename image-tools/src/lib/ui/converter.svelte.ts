import { convertFile, zipBlobs, type Converted, type Format } from '$lib/engine';

export type JobStatus = 'queued' | 'working' | 'done' | 'error';

export interface Job {
	id: number;
	file: File;
	status: JobStatus;
	result: Converted | null;
	/** Object URL of the converted blob — doubles as preview and download href. */
	url: string | null;
	error: string | null;
}

let nextId = 1;

/**
 * The conversion queue. Files convert one at a time (decoding and encoding
 * are CPU-heavy); rows update reactively as each finishes. Changing target
 * or quality re-runs finished files from the original File objects.
 */
export class Converter {
	target = $state<Format>()!;
	targetExt = $state<string | undefined>(undefined);
	quality = $state(90);
	/** Fill colour for targets that cannot keep transparency, e.g. JPG. */
	background = $state('#ffffff');
	jobs = $state<Job[]>([]);

	doneCount = $derived(this.jobs.filter((j) => j.status === 'done').length);
	busy = $derived(this.jobs.some((j) => j.status === 'queued' || j.status === 'working'));

	#pumping = false;

	constructor(target: Format, targetExt?: string) {
		this.target = target;
		this.targetExt = targetExt;
	}

	add(files: Iterable<File>) {
		for (const file of files) {
			this.jobs.push({ id: nextId++, file, status: 'queued', result: null, url: null, error: null });
		}
		void this.#pump();
	}

	remove(id: number) {
		const job = this.jobs.find((j) => j.id === id);
		if (job?.url) URL.revokeObjectURL(job.url);
		this.jobs = this.jobs.filter((j) => j.id !== id);
	}

	retry(id: number) {
		const job = this.jobs.find((j) => j.id === id);
		if (!job) return;
		job.status = 'queued';
		job.error = null;
		void this.#pump();
	}

	/** New target format (landing page picker) — every file converts again. */
	setTarget(target: Format, targetExt?: string) {
		this.target = target;
		this.targetExt = targetExt;
		this.#requeue(this.jobs);
	}

	/** A setting changed, so finished results are stale. Convert them again. */
	redoDone() {
		this.#requeue(this.jobs.filter((j) => j.status === 'done'));
	}

	async zipAll(): Promise<Blob> {
		const done = this.jobs.filter((j) => j.status === 'done' && j.result);
		const entries = await Promise.all(
			done.map(async (j) => ({
				name: j.result!.name,
				data: new Uint8Array(await j.result!.blob.arrayBuffer())
			}))
		);
		return zipBlobs(entries);
	}

	destroy() {
		for (const job of this.jobs) {
			if (job.url) URL.revokeObjectURL(job.url);
		}
		this.jobs = [];
	}

	#requeue(jobs: Job[]) {
		for (const job of jobs) {
			job.status = 'queued';
			job.error = null;
		}
		void this.#pump();
	}

	async #pump() {
		if (this.#pumping) return;
		this.#pumping = true;
		try {
			let job: Job | undefined;
			while ((job = this.jobs.find((j) => j.status === 'queued'))) {
				job.status = 'working';
				try {
					const result = await convertFile(job.file, this.target, {
						quality: this.quality,
						background: this.background,
						targetExt: this.targetExt
					});
					if (job.url) URL.revokeObjectURL(job.url);
					job.result = result;
					job.url = URL.createObjectURL(result.blob);
					job.status = 'done';
				} catch (err) {
					job.status = 'error';
					job.error = err instanceof Error ? err.message : 'Something went wrong';
				}
			}
		} finally {
			this.#pumping = false;
		}
	}
}
