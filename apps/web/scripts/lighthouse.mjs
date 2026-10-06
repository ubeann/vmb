// Runs Lighthouse's performance category against a page, signed in or not,
// and prints each run plus the median (docs/agents/page-checks.md).
//
//   node apps/web/scripts/lighthouse.mjs <url> [--login] [--runs 3] [--desktop] [--out <dir>]
//
// `--login` signs in first (sign-in.mjs) and sends the session cookie with
// every Lighthouse request. A run that lands on /login instead of the page
// asked for fails loudly rather than scoring the login page. Reports are kept
// as JSON in `--out` (a fresh temp directory by default).
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL } from "node:url";
import { chromium } from "playwright";
import { isLoginPage, signIn } from "./sign-in.mjs";

// Pinned so runs compare across sessions; audit ids move between majors.
const LIGHTHOUSE = "lighthouse@13.5.0";

const [url, ...flags] = process.argv.slice(2);
if (!url) {
  console.error("usage: lighthouse.mjs <url> [--login] [--runs 3] [--desktop] [--out <dir>]");
  process.exit(1);
}
const flag = (name, fallback) => {
  const index = flags.indexOf(name);
  return index === -1 ? fallback : flags[index + 1];
};
const runs = Number(flag("--runs", 3));
const outDir = flag("--out", undefined) ?? (await mkdtemp(join(tmpdir(), "vmb-lighthouse-")));
await mkdir(outDir, { recursive: true });

let cookie;
if (flags.includes("--login")) {
  const browser = await chromium.launch();
  const cookies = await signIn(await browser.newContext(), new URL(url).origin);
  await browser.close();
  cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

const rows = [];
for (let run = 1; run <= runs; run++) {
  const file = join(outDir, `run-${run}.json`);
  const result = spawnSync(
    "npx",
    [
      "--yes",
      LIGHTHOUSE,
      url,
      "--only-categories=performance",
      "--output=json",
      `--output-path=${file}`,
      "--quiet",
      "--chrome-flags=--headless=new",
      ...(flags.includes("--desktop") ? ["--preset=desktop"] : []),
      ...(cookie ? [`--extra-headers=${JSON.stringify({ Cookie: cookie })}`] : [])
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  if (result.status !== 0) {
    console.error(`run ${run}: lighthouse exited ${result.status}`);
    process.exit(1);
  }
  const report = JSON.parse(await readFile(file, "utf8"));
  if (isLoginPage(report.finalDisplayedUrl) && !isLoginPage(url)) {
    console.error(
      `run ${run}: ended on ${report.finalDisplayedUrl}; pass --login for a signed-in page`
    );
    process.exit(1);
  }
  const audit = (id) => report.audits[id]?.numericValue;
  const row = {
    score: Math.round((report.categories.performance.score ?? 0) * 100),
    fcp: audit("first-contentful-paint") / 1000,
    lcp: audit("largest-contentful-paint") / 1000,
    tbt: audit("total-blocking-time"),
    cls: audit("cumulative-layout-shift")
  };
  rows.push(row);
  console.log(`run ${run}: ${format(row)}`);
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const medians = Object.fromEntries(
  Object.keys(rows[0]).map((key) => [key, median(rows.map((row) => row[key]))])
);
console.log(`median: ${format(medians)}`);
console.log(`reports: ${outDir}`);

function format({ score, fcp, lcp, tbt, cls }) {
  return `score ${Math.round(score)}  FCP ${fcp.toFixed(2)}s  LCP ${lcp.toFixed(2)}s  TBT ${Math.round(tbt)}ms  CLS ${cls.toFixed(3)}`;
}
