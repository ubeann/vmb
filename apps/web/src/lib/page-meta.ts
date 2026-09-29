// Head metadata for the auth pages and the error page (#207), rendered by
// PageMeta.svelte. VMB is an internal tool, so this serves the browser tab and
// link previews — an activation link pasted into WhatsApp or Slack — not
// search ranking; app.html keeps every page out of search indexes.
const SITE_NAME = "VMB";

// Built by docs/design/etched-login/build-brand-assets.mjs.
export const OG_IMAGE = {
  path: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: 'The VMB logo and the line "Every crate, container and receipt, on record." over an engraved landscape of warehouses, container trucks on a bridge and a container yard.'
};

export type MetaTag = { name: string; content: string } | { property: string; content: string };

// Open Graph tags are keyed by `property`, the rest by `name`.
export function metaKey(tag: MetaTag): string {
  return "name" in tag ? tag.name : tag.property;
}

export function pageTitle(title: string): string {
  return `${title} — ${SITE_NAME}`;
}

export function metaTags({
  title,
  description,
  url
}: {
  title: string;
  description: string;
  url: URL;
}): MetaTag[] {
  const fullTitle = pageTitle(title);
  // Crawlers fetch og:image on their own, so it must be absolute.
  const image = new URL(OG_IMAGE.path, url.origin).href;

  return [
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: new URL(url.pathname, url.origin).href },
    { property: "og:image", content: image },
    { property: "og:image:width", content: String(OG_IMAGE.width) },
    { property: "og:image:height", content: String(OG_IMAGE.height) },
    { property: "og:image:alt", content: OG_IMAGE.alt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image }
  ];
}
