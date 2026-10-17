/** Accept only same-origin paths, including when encoded or normalized by a browser. */
export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/platform/project",
): string {
  if (!value || !value.startsWith("/") || /[\\\u0000-\u0020]/.test(value))
    return fallback;
  try {
    const url = new URL(value, "https://phonemockup.invalid");
    if (url.origin !== "https://phonemockup.invalid") return fallback;
    if (/^\/(sign-in|sign-up)(\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
