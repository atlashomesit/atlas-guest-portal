import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LostItemReportCard, isWithinLostItemWindow } from "./LostItemReportCard";
import { api } from "../../api/client";

vi.mock("../../api/client", () => ({
  api: {
    post: vi.fn(),
  },
}));

describe("LostItemReportCard (GUEST-093)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides card for future bookings not checked out", () => {
    const now = new Date("2026-11-27T10:00:00Z");
    const { container } = render(
      <LostItemReportCard
        bookingId={101}
        status="Confirmed"
        checkoutDateIso="2026-12-05"
        now={now}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("hides card when more than 30 days past checkout", () => {
    expect(
      isWithinLostItemWindow({
        status: "CheckedOut",
        checkoutDateIso: "2026-10-01",
        now: new Date("2026-11-27T10:00:00Z"),
      }),
    ).toBe(false);
  });

  it("renders button, validates photo type, and submits a lost item report", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        id: 77,
        itemDescription: "Blue passport holder",
        whereLeft: "Bedside drawer",
        status: "Reported",
      },
    });

    const now = new Date("2026-11-27T10:00:00Z");
    render(
      <LostItemReportCard
        bookingId={101}
        token="tok-123"
        status="CheckedOut"
        checkoutDateIso="2026-11-25"
        now={now}
      />,
    );

    fireEvent.click(screen.getByTestId("lost-item-open-btn"));
    expect(screen.getByTestId("lost-item-form")).toBeInTheDocument();

    const badFile = new File(["hello"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("lost-item-photo"), {
      target: { files: [badFile] },
    });
    expect(screen.getByTestId("lost-item-photo-error")).toHaveTextContent("JPG, PNG, or WebP");

    fireEvent.change(screen.getByTestId("lost-item-desc"), {
      target: { value: "Blue passport holder" },
    });
    fireEvent.change(screen.getByTestId("lost-item-where"), {
      target: { value: "Bedside drawer" },
    });
    fireEvent.click(screen.getByTestId("lost-item-submit-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("lost-item-success")).toBeInTheDocument();
    });

    expect(api.post).toHaveBeenCalledWith(
      "/public/bookings/101/lost-items",
      expect.any(FormData),
      { params: { t: "tok-123" } },
    );
    expect(screen.getByTestId("lost-item-row-77")).toHaveTextContent("Blue passport holder");
    expect(screen.getByTestId("lost-item-row-77")).toHaveTextContent("Reported");
  });
});
