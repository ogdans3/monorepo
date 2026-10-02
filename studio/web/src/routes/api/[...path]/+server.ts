import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const proxy: RequestHandler = async ({ request, params, url }) => {
  const target = new URL(
    '/api/' + params.path + url.search,
    env.API_URL || 'http://127.0.0.1:8088',
  );
  const headers = new Headers();
  for (const name of ['content-type', 'cookie', 'authorization', 'origin']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      redirect: 'manual',
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      // Node's streaming request bodies require duplex.
      duplex: 'half',
      signal: request.signal,
    } as RequestInit);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('connection');
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json(
      { error: 'Får ikke kontakt med Studio. Prøv igjen om litt.' },
      { status: 503 },
    );
  }
};
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
