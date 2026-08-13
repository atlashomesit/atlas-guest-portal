import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("index.html boot shell (TASK-7839 / TASK-7822)", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");

  it("inlines a first-paint shell so FCP does not wait for the SPA bundle", () => {
    expect(html).toContain('data-testid="boot-shell"');
    expect(html).toContain("boot-nav");
    expect(html).toContain("boot-hero");
    expect(html).toContain("aspect-ratio: 4 / 3");
    expect(html).toContain("--boot-nav-height: 116px");
  });

  it("loads webfonts with display=optional so desktop heading swap cannot CLS", () => {
    expect(html).toContain("display=optional");
    expect(html).not.toContain("display=swap");
  });
});
