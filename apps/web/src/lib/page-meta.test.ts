import { describe, expect, it } from "vitest";
import { metaKey, metaTags, OG_IMAGE, pageTitle } from "./page-meta.js";

describe("pageTitle", () => {
  it("suffixes the page's name with the site name", () => {
    expect(pageTitle("Log in")).toBe("Log in — VMB");
  });
});

describe("metaTags", () => {
  const tags = metaTags({
    title: "Log in",
    description: "Sign in to VMB.",
    url: new URL("https://vmb.example/activate?email=a%40b.c#top")
  });
  const content = (key: string) => tags.find((tag) => metaKey(tag) === key)?.content;

  it("gives search and link previews the description", () => {
    expect(content("description")).toBe("Sign in to VMB.");
    expect(content("og:description")).toBe("Sign in to VMB.");
    expect(content("twitter:description")).toBe("Sign in to VMB.");
  });

  it("titles previews with the full page title", () => {
    expect(content("og:title")).toBe("Log in — VMB");
    expect(content("twitter:title")).toBe("Log in — VMB");
    expect(content("og:site_name")).toBe("VMB");
  });

  it("points previews at the page without its query or fragment", () => {
    expect(content("og:url")).toBe("https://vmb.example/activate");
  });

  it("links the preview image by absolute URL, as crawlers require", () => {
    expect(content("og:image")).toBe(`https://vmb.example${OG_IMAGE.path}`);
    expect(content("twitter:image")).toBe(`https://vmb.example${OG_IMAGE.path}`);
    expect(content("og:image:width")).toBe("1200");
    expect(content("og:image:height")).toBe("630");
    expect(content("og:image:alt")).toBe(OG_IMAGE.alt);
    expect(content("twitter:card")).toBe("summary_large_image");
  });
});
