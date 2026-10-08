import { proxyAPI } from '$lib/server/api-proxy';
import type { RequestHandler } from './$types';

const proxy: RequestHandler = ({ request, params }) => proxyAPI(request, '/api/' + params.path);
export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
