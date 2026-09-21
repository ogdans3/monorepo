/**
 * Rendered in the browser only.
 *
 * The index of lists lives in this browser's storage and nowhere else. This
 * server has never heard of it and never will, so there is nothing here for it
 * to render — the same reason the list route itself is client-rendered.
 */
export const ssr = false;
