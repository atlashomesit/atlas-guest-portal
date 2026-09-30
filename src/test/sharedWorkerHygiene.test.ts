import { afterEach, describe, expect, it } from "vitest";
import { restoreDocumentVisibility } from "./sharedWorkerHygiene";

// TASK-102734: a file that pins document.visibilityState must not hand a hidden tab to the next file its shared
// (isolate:false) worker runs. See the note in ./sharedWorkerHygiene.ts.
afterEach(() => {
  restoreDocumentVisibility();
});

describe("restoreDocumentVisibility", () => {
  it("starts from a visible tab", () => {
    expect(document.visibilityState).toBe("visible");
  });

  it("undoes a value override (the abandonOnDeparture shape)", () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    expect(document.visibilityState).toBe("hidden");
    restoreDocumentVisibility();
    expect(document.visibilityState).toBe("visible");
  });

  it("undoes a getter override (the GuestMessageThread.visibility shape)", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    expect(document.visibilityState).toBe("hidden");
    restoreDocumentVisibility();
    expect(document.visibilityState).toBe("visible");
  });

  it("is a no-op when nothing was overridden", () => {
    expect(() => restoreDocumentVisibility()).not.toThrow();
    expect(document.visibilityState).toBe("visible");
  });
});
