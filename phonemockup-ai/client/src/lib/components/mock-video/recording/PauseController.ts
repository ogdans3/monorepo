export class PauseController {
    private _paused = false;
    private resolvers: Array<() => void> = [];

    get paused(): boolean {
        return this._paused;
    }

    pause(): void {
        if (this._paused) return;
        this._paused = true;
    }

    resume(): void {
        if (!this._paused) return;
        this._paused = false;
        const list = this.resolvers;
        this.resolvers = [];
        for (const resolve of list) resolve();
    }

    async wait(signal?: AbortSignal): Promise<void> {
        if (!this._paused) {
            return;
        }
        if (signal?.aborted) {
            return;
        }
        return new Promise<void>((resolve) => {
            const onAbort = () => {
                cleanup();
                resolve();
            };
            const onResume = () => {
                cleanup();
                resolve();
            };
            const cleanup = () => {
                this.removeAbortListener(signal, onAbort);
                const idx = this.resolvers.indexOf(onResume);
                if (idx !== -1) this.resolvers.splice(idx, 1);
            };

            if (signal) {
                signal.addEventListener("abort", onAbort, {once: true});
            }
            this.resolvers.push(onResume);
        });
    }

    private removeAbortListener(signal: AbortSignal | undefined, fn: () => void) {
        if (!signal) return;
        try {
            signal.removeEventListener("abort", fn);
        } catch {
        }
    }
}