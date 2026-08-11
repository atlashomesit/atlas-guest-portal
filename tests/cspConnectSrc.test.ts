import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * TASK-7705 addendum (found 2026-08-08 while verifying the QA guest surface live): public/_headers
 * ships the SAME Content-Security-Policy to every Cloudflare Pages environment built from this
 * repo - prod, dev, and now qa. connect-src is a hardcoded host allowlist, not derived from
 * ATLAS_API_BASE_URL, so a host absent from this list is invisible to app code: the browser blocks
 * the fetch at the CSP layer before it reaches the network, and the SPA's error handling cannot
 * distinguish that from a genuine network failure ("Failed to fetch" — the exact symptom hit live
 * on qa.atlashomestays.com despite /.well-known/atlas-runtime-config.json itself returning 200).
 *
 * This guards the allowlist directly against the raw file so a future qaapi rename/removal reds
 * here instead of shipping a portal that can build, deploy, and pass every other check while every
 * live API call silently fails.
 */
describe("public/_headers Content-Security-Policy connect-src (TASK-7705)", () => {
  const headersFile = readFileSync(join(__dirname, "../public/_headers"), "utf-8");
  const cspLine = headersFile.split("\n").find((l) => l.includes("Content-Security-Policy"));

  if (!cspLine) throw new Error("public/_headers has no Content-Security-Policy line");
  const connectSrcMatch = cspLine.match(/connect-src ([^;]+);/);
  if (!connectSrcMatch) throw new Error("Content-Security-Policy has no connect-src directive");
  const connectSrc = connectSrcMatch[1];

  it("allows the QA API host", () => {
    expect(connectSrc).toContain("https://qaapi.atlaspms.in");
  });

  it("still allows the production API host", () => {
    expect(connectSrc).toContain("https://api.atlaspms.in");
  });

  it("still allows the dev API host", () => {
    expect(connectSrc).toContain(
      "https://atlas-homes-api-dev-fhdtg0gkgmcmhwfd.centralindia-01.azurewebsites.net",
    );
  });
});
