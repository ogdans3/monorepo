// Everything on screen is live, so there is nothing to render on a server:
// the Go server hands out one shell and the app routes in the browser.
export const ssr = false;
export const prerender = false;
