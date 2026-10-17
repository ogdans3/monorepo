import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

// Runtime configuration keeps the Docker image independent of a Clerk instance.
// Only the publishable key crosses the server/client boundary.
export function load() {
  return {
    clerkPublishableKey:
      publicEnv.PUBLIC_CLERK_PUBLISHABLE_KEY ||
      privateEnv.CLERK_PUBLISHABLE_KEY ||
      privateEnv.VITE_CLERK_PUBLISHABLE_KEY ||
      "",
  };
}
