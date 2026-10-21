import type { Clerk } from "@clerk/clerk-js";
import { goto } from "$app/navigation";
import { browser } from "$app/environment";

type AuthStatus = "loading" | "ready" | "unconfigured" | "error";
export const auth = $state({
  status: "loading" as AuthStatus,
  userId: null as string | null,
});
let instance: Clerk | null = null;
let pending: Promise<Clerk | null> | null = null;
let publishableKey = "";
let unsubscribe: (() => void) | undefined;

export function getClerk() {
  return instance;
}

async function navigate(to: string, replaceState = false) {
  const url = new URL(to, window.location.origin);
  if (url.origin === window.location.origin) {
    await goto(`${url.pathname}${url.search}${url.hash}`, { replaceState });
  } else if (url.protocol === "https:" || url.protocol === "http:") {
    // Clerk may navigate to its hosted account portal or an OAuth provider.
    if (replaceState) window.location.replace(url.href);
    else window.location.assign(url.href);
  }
}

export function initializeAuth(key = publishableKey): Promise<Clerk | null> {
  if (!browser) return Promise.resolve(null);
  publishableKey = key;
  if (!key) {
    auth.status = "unconfigured";
    return Promise.resolve(null);
  }
  if (instance && auth.status === "ready") return Promise.resolve(instance);
  if (pending) return pending;
  auth.status = "loading";
  pending = (async () => {
    try {
      const [{ Clerk }, { ui }, { shadcn }] = await Promise.all([
        import("@clerk/clerk-js"),
        import("@clerk/ui"),
        import("@clerk/ui/themes"),
      ]);
      const clerk = instance ?? new Clerk(key);
      await clerk.load({
        ui,
        signInUrl: "/sign-in",
        signUpUrl: "/sign-up",
        signInFallbackRedirectUrl: "/platform/project",
        signUpFallbackRedirectUrl: "/platform/project",
        afterSignOutUrl: "/",
        routerPush: (to) => navigate(to),
        routerReplace: (to) => navigate(to, true),
        appearance: {
          theme: shadcn,
          variables: {
            colorPrimary: "#a3442c",
            colorBackground: "#fffefa",
            colorForeground: "#282923",
            colorMutedForeground: "#5c5d55",
            colorInputBackground: "#ffffff",
            colorInputForeground: "#282923",
            fontFamily: "Archivo, sans-serif",
            borderRadius: "5px",
          },
        },
      });
      instance = clerk;
      unsubscribe?.();
      unsubscribe = clerk.addListener(({ user }) => {
        auth.userId = user?.id ?? null;
      });
      auth.userId = clerk.user?.id ?? null;
      auth.status = "ready";
      return clerk;
    } catch {
      // Auth outages must not prevent local editing or export.
      auth.status = "error";
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** The API accepts Clerk session tokens, never client-supplied user/owner IDs. */
export async function authenticatedFetch(
  path: string,
  options: RequestInit = {},
) {
  if (!path.startsWith("/api/") || /[\\\u0000-\u0020]/.test(path)) {
    throw new Error("Authenticated requests must target this app’s API.");
  }
  const token = await instance?.session?.getToken();
  if (!token) throw new Error("Sign in to continue.");
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  // Do not follow an API redirect with credentials to an unexpected target.
  return fetch(path, {
    ...options,
    headers,
    credentials: "omit",
    redirect: "error",
  });
}
