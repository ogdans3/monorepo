import type { FastifyInstance } from 'fastify';
import { demoToggleBodySchema } from '@checkpost/contract';
import { parseBody } from './parse.js';

/**
 * The list on the landing page, and the one change anybody may make to it.
 *
 * No credential, deliberately: the front page is for people who have never
 * heard of Checkpost, and asking them for a link to see the thing that
 * explains what a link is would be a circle. What keeps it safe is that this
 * is the entire write surface for that list — one boolean on one row — and
 * that the link it hands out is `read`. See `DemoService`.
 */
export async function demoRoutes(app: FastifyInstance): Promise<void> {
  const demo = app.demoService;

  app.get('/demo', async () => demo.intro());

  app.post(
    '/demo/tick',
    // Tighter than the shared bucket. This one writes, and unlike every other
    // write in the product it does not cost the caller a link first.
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => {
      const body = parseBody(demoToggleBodySchema, request.body);
      return demo.tick(body.id, body.checked, request.actor);
    },
  );
}
