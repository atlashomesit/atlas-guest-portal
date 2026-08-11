import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import DamageWaiverSignature from "./DamageWaiverSignature";

afterEach(() => {
  cleanup();
});

describe("DamageWaiverSignature", () => {
  test("typed mode submits typedName", () => {
    const onSign = vi.fn();
    render(<DamageWaiverSignature busy={false} onCancel={() => undefined} onSign={onSign} />);

    fireEvent.change(screen.getByTestId("waiver-typed-name"), { target: { value: "Priya Sharma" } });
    fireEvent.click(screen.getByTestId("waiver-sign-submit"));

    expect(onSign).toHaveBeenCalledWith({ signatureType: "typed", typedName: "Priya Sharma" });
  });

  test("submit disabled until typed name present", () => {
    render(<DamageWaiverSignature busy={false} onCancel={() => undefined} onSign={() => undefined} />);
    expect(screen.getByTestId("waiver-sign-submit")).toBeDisabled();
  });
});
