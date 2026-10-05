import { avatarSvg } from "$lib/avatar.js";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";

// The placeholder picture for a user, as an image the browser caches: the SVG
// is about 20 KB, too much to inline for every avatar on a page. The seed and
// the query decide the whole body, so the response never changes.
export const GET: RequestHandler = ({ params, url }) => {
  if (params.seed.length > 128) error(400, "Seed too long");

  const svg = avatarSvg(params.seed, {
    theme: url.searchParams.get("theme") === "dark" ? "dark" : "light",
    animated: url.searchParams.get("animated") === "1"
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "private, max-age=31536000, immutable",
      // Opened directly rather than in an <img>, it may style itself and nothing else.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'"
    }
  });
};
