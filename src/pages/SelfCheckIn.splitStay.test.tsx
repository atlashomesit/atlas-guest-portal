/**
 * TASK-102915: split-stay legs on the guest self check-in summary.
 *
 * A split stay lists every room with its dates in date order, badges tonight's
 * room, and shows the door code for tonight's room only — a future leg never
 * carries a code, so none may render. Single-room bookings (no `stays` from the
 * API) render exactly as before.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi, type Mock } from "vitest";
import SelfCheckIn from "./SelfCheckIn";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));

const singleRoomDetails = {
  bookingRef: "ATL2026-001234",
  listingName: "Atlas Stay",
  propertyAddress: "Somewhere",
  checkinDate: "2026-05-12",
  checkoutDate: "2026-05-14",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  checkinInstructions: "",
  wifiName: "",
  wifiPassword: "",
  houseRulesText: "",
  emergencyContactPhone: "",
  doorCode: "4821",
  idUploadRequired: true,
  houseRulesSignedAt: null,
};

const splitStayDetails = {
  ...singleRoomDetails,
  // Deliberately out of order: the UI must sort by start date.
  stays: [
    { roomName: "Room 102", startDate: "2026-10-03", endDate: "2026-10-29", isCurrentLeg: false },
    { roomName: "Room 302", startDate: "2026-09-29", endDate: "2026-10-03", isCurrentLeg: true },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/checkin"]}>
      <SelfCheckIn />
    </MemoryRouter>,
  );
}

async function verifyBooking(details: unknown) {
  (global.fetch as Mock).mockResolvedValueOnce(
    new Response(JSON.stringify(details), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  renderPage();

  fireEvent.change(screen.getByLabelText("Booking reference"), {
    target: { value: "ATL2026-001234" },
  });
  fireEvent.change(screen.getByLabelText("Last name"), {
    target: { value: "Guest" },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  await settle();
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SelfCheckIn split stay (TASK-102915)", () => {
  test("lists every room in date order with tonight badged", async () => {
    await verifyBooking(splitStayDetails);

    const items = screen.getAllByTestId("self-checkin-stay-leg");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Room 302");
    expect(items[1]).toHaveTextContent("Room 102");
    expect(screen.getByText("Your rooms")).toBeInTheDocument();
    expect(screen.getByText("Tonight")).toBeInTheDocument();
  });

  test("shows the door code exactly once — for tonight's room only", async () => {
    await verifyBooking(splitStayDetails);

    expect(screen.getAllByText("4821")).toHaveLength(1);
    const legs = screen.getByTestId("self-checkin-stay-legs");
    expect(legs).not.toHaveTextContent("4821");
  });

  test("single-room booking renders no rooms section", async () => {
    await verifyBooking(singleRoomDetails);

    expect(screen.getByText("Atlas Stay")).toBeInTheDocument();
    expect(screen.queryByTestId("self-checkin-stay-legs")).not.toBeInTheDocument();
  });
});
