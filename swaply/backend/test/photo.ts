// A photograph on disk the way an upload leaves one, for the flows where a
// listing has pictures but the pictures are not the point. A listing takes
// only what was stored here (`assertMedia` in routes/items.ts), so a made-up
// URL no longer stands in for one. `flows/photos.test.ts` is the flow that
// uploads over HTTP.
import { storeImage } from '../src/lib/media.js'

/** The smallest valid PNG there is: one transparent pixel, header and all. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** The path `POST /media` would have handed back, with real bytes behind it. */
export async function storedPhoto(): Promise<string> {
  return (await storeImage(PNG)).path
}
