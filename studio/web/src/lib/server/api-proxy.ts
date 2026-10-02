import { env } from '$env/dynamic/private';

export async function proxyAPI(request: Request, pathname: string): Promise<Response> {
  const target = new URL(
    pathname + new URL(request.url).search,
    env.API_URL || 'http://127.0.0.1:8088',
  );
  const headers = new Headers();
  for (const name of [
    'content-type',
    'accept',
    'cookie',
    'authorization',
    'origin',
    'upload-offset',
    'range',
    'if-range',
    'mcp-protocol-version',
    'mcp-session-id',
    'last-event-id',
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      redirect: 'manual',
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
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
}
