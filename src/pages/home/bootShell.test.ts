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
    expect(html).toContain("boot-widget");
    expect(html).toContain("aspect-ratio: 4 / 3");
    expect(html).toContain("--boot-nav-height: 116px");
  });

  it("TASK-7822: boot hero is one centered column matching .ahv2-hero, not a 2-col photo split", () => {
    expect(html).toContain("flex-direction: column");
    expect(html).toContain("min-height: min(72vh, 760px)");
    expect(html).not.toContain("grid-template-columns: 1fr 1fr");
    expect(html).not.toContain("boot-photo");
  });

  it("loads webfonts with display=optional so desktop heading swap cannot CLS", () => {
    expect(html).toContain("display=optional");
    expect(html).not.toContain("display=swap");
  });
});

describe("navbar.css (TASK-7822)", () => {
  const css = readFileSync(join(root, "src/components/commonComponents/navbar/navbar.css"), "utf8");

  it("reserves desktop nav as nowrap so the fixed header cannot wrap after paint", () => {
    expect(css).toContain("flex-wrap: nowrap");
    expect(css).toContain("min-width: 761px");
  });
});
