import posthog from "posthog-js";
import { browser } from "$app/environment";

/** The URL without what was typed into a search (`q`). */
function withoutSearch(url: unknown) {
  if (typeof url !== "string" || !url.includes("q=")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("q")) parsed.searchParams.set("q", "");
    return parsed.toString();
  } catch {
    return url;
  }
}

export const load = async ({ data }) => {
  if (browser) {
    posthog.init("phc_d6q9UL8mxg9gzlDXUcEz4azOSxawQ4nYGDTUI1n4p57", {
      api_host: "https://e.phonemockup.app",
      ui_host: "https://eu.posthog.com",
      defaults: "2025-05-24",
      person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
      // Project and file names stay on the device, as My projects promises:
      // the studio's page title is the project name, and a library search
      // is in the URL. Elements that show names carry ph-no-capture.
      before_send: (event) => {
        const properties = event?.properties;
        if (properties) {
          delete properties.title;
          for (const key of ["$current_url", "$referrer"]) {
            properties[key] = withoutSearch(properties[key]);
          }
        }
        return event;
      },
    });
  }

  // Preserve server-provided runtime configuration for the root layout.
  return data;
};
