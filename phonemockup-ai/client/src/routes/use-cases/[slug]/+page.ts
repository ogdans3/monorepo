import { error } from "@sveltejs/kit";
import { findGuide } from "$lib/guides/guides";
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => {
  const guide = findGuide("use-cases", params.slug);
  if (!guide) error(404, "There is no such guide.");
  return { guide };
};
