import { proxyAPI } from '$lib/server/api-proxy';
import type { RequestHandler } from './$types';

const proxy: RequestHandler = ({ request }) => proxyAPI(request, '/mcp');

export const POST = proxy;
export const GET = proxy;
export const HEAD = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
