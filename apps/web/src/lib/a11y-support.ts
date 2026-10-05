import axe from "axe-core";

// The WCAG 2.2 AA rules axe can check from the DOM. Best-practice rules stay
// out: `region` and the like judge a whole page, and these renders are one
// card of it.
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// What axe finds wrong inside `root`, one line per rule and its nodes, so a
// failing `toEqual([])` names the rule and the element.
//
// `color-contrast` reads the stylesheet's colours, so it is right for a card
// rendered alone. The etched artwork behind the real page is invisible to it
// (it reports a false 2.47:1 under the hero text, which a pixel measure puts
// well above 4.5:1): pass `contrast: false` for a render that includes it, and
// measure contrast over the artwork from a screenshot instead (#208).
export async function axeViolations(
  root: Element,
  { contrast = true }: { contrast?: boolean } = {}
) {
  const results = await axe.run(root, {
    runOnly: { type: "tag", values: WCAG_AA },
    rules: { "color-contrast": { enabled: contrast } }
  });
  return results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes
        .map((node) => node.target.join(" "))
        .join(", ")}`
  );
}
