import { env } from '$env/dynamic/public';

/**
 * Store links are unset until the app ships. Every surface that would link to
 * a store checks for an empty string and degrades to honest copy rather than
 * a dead button.
 */
export const appStoreUrl = env.PUBLIC_APP_STORE_URL ?? '';
export const playStoreUrl = env.PUBLIC_PLAY_STORE_URL ?? '';
export const storesLive = Boolean(appStoreUrl || playStoreUrl);
