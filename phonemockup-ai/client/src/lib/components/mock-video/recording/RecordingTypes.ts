export interface IFrameEncoder {
    init(): Promise<void>;

    addFrame(tSec: number, dtSec: number): Promise<void>;

    finalize(): Promise<Blob>;

    /** Drop a run that won't be finished, releasing the encoder. */
    cancel?(): Promise<void>;
}
