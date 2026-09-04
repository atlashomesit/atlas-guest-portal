import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * TASK-10164: Cloudflare Pages _headers MERGES matching rules. A frame-ancestors token on
 * the catch-all /* rule would either framable the whole guest portal (https: http:) or
 * intersect with /embed/* and kill the widget ('none'). Frame ancestors belong only in
 * functions/_middleware.ts, which emits exactly one value per path.
 */
describe("public/_headers frame-ancestors (TASK-10164)", () => {
  const headersFile = readFileSync(join(__dirname, "../public/_headers"), "utf-8");

  function cspForRule(rule: string): string {
    const lines = headersFile.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.trim() === rule);
    if (idx < 0) throw new Error(`missing ${rule} rule`);
    for (let i = idx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^[^\s/]/.test(line) && !line.startsWith(" ")) break;
      if (line.includes("Content-Security-Policy")) return line;
    }
    throw new Error(`no CSP under ${rule}`);
  }

  it("does not set frame-ancestors on the catch-all /* rule", () => {
    expect(cspForRule("/*").toLowerCase()).not.toContain("frame-ancestors");
  });

  it("does not set frame-ancestors on /embed/* (middleware owns that token)", () => {
    expect(cspForRule("/embed/*").toLowerCase()).not.toContain("frame-ancestors");
  });
});
