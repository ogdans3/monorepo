import type { Handle } from "@sveltejs/kit";
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

// Runtime configuration keeps the Docker image independent of a Clerk instance.
// Only the publishable key crosses the server/client boundary.
function clerkPublishableKey() {
  return (
    publicEnv.PUBLIC_CLERK_PUBLISHABLE_KEY ||
    privateEnv.CLERK_PUBLISHABLE_KEY ||
    privateEnv.VITE_CLERK_PUBLISHABLE_KEY ||
    ""
  );
}

const attribute = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The key is written into the page rather than returned by a server load: a
// server load makes every client-rendered page (the studio, a saved project)
// fetch __data.json before it starts, and the dashboard proxy in front of the
// test copy answers that with a 404, so a link or a reload showed
// "Page not found".
export const handle: Handle = ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace(
        "%phonemockup.clerkPublishableKey%",
        attribute(clerkPublishableKey()),
      ),
  });
