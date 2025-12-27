import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import BookingForm from "../src/components/homepage_components/homepage_Propertydetails/BookingFrom";

const sendMock = vi.hoisted(() => vi.fn());
const mockLogUserAction = vi.hoisted(() => vi.fn());
const mockReportError = vi.hoisted(() => vi.fn());
const mockIsEmailJsConfigured = vi.hoisted(() => vi.fn(() => true));
const mockGetMissingEmailJsEnvKeys = vi.hoisted(() => vi.fn(() => []));

const formatDate = (date: Date) => date.toISOString().split("T")[0];
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

vi.mock("@emailjs/browser", () => ({
  default: { send: sendMock },
  send: sendMock,
}));

vi.mock("../src/lib/monitoring", () => ({
  logUserAction: mockLogUserAction,
  reportError: mockReportError,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../src/utils/emailjsConfig", () => ({
  emailJsConfig: {
    serviceId: "service-123",
    templateId: "template-abc",
    publicKey: "public-key",
    ownerEmail: "owner@example.com",
  },
  getMissingEmailJsEnvKeys: mockGetMissingEmailJsEnvKeys,
  isEmailJsConfigured: mockIsEmailJsConfigured,
}));

describe("BookingFrom", () => {
  const renderForm = () => render(<BookingForm propertyData={{ property_name: "Test Penthouse" }} />);

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2024, 11, 15, 12));
    sendMock.mockResolvedValue({ status: 200 });
    mockIsEmailJsConfigured.mockReturnValue(true);
    mockGetMissingEmailJsEnvKeys.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.useRealTimers();
  });

  test("formats default dates using calendar month values", () => {
    vi.setSystemTime(new Date(2024, 0, 5, 12));

    const { container } = renderForm();
    const dateInputs = container.querySelectorAll('input[type="date"]');

    expect(dateInputs[0]).toHaveValue("2024-01-05");
    expect(dateInputs[1]).toHaveValue("2024-01-06");
  });

  test("sends booking request with aggregated pricing when inputs are valid", async () => {
    const { container } = renderForm();
    const [checkInInput, checkOutInput] = container.querySelectorAll('input[type="date"]');
    const baseDate = new Date();
    const checkInValue = formatDate(addDays(baseDate, 15));
    const checkOutValue = formatDate(addDays(baseDate, 17));

    fireEvent.change(screen.getByPlaceholderText(/Name/i), { target: { value: "John Doe" } });
    fireEvent.change(screen.getByPlaceholderText(/Contact Number/i), { target: { value: "1234567890" } });
    fireEvent.change(screen.getByPlaceholderText(/Email/i), { target: { value: "guest@example.com" } });

    fireEvent.change(checkInInput, { target: { value: checkInValue } });
    fireEvent.change(checkOutInput, { target: { value: checkOutValue } });

    fireEvent.click(screen.getByRole("checkbox", { name: /i have read and agree/i }));

    fireEvent.click(screen.getByRole("button", { name: /reserve/i }));

    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1));

    const [, , templateParams] = sendMock.mock.calls[0];

    expect(templateParams.nights).toBe(2);
    expect(templateParams.total_guests).toBe(1);
    expect(templateParams.message).toContain("Total Price: ₹14,940");
    expect(templateParams.check_in).toBe(checkInValue);
    expect(templateParams.check_out).toBe(checkOutValue);

    expect(mockLogUserAction).toHaveBeenCalledWith("booking_form_submitted", expect.any(Object));
    expect(mockReportError).not.toHaveBeenCalled();
  });

  test("prevents submission and surfaces validation errors", async () => {
    const { container } = renderForm();
    const [checkInInput, checkOutInput] = container.querySelectorAll('input[type="date"]');
    const baseDate = new Date();
    const checkInValue = formatDate(addDays(baseDate, 10));
    const checkOutValue = formatDate(addDays(baseDate, 11));

    fireEvent.change(checkInInput, { target: { value: checkInValue } });
    fireEvent.change(checkOutInput, { target: { value: checkOutValue } });

    fireEvent.click(screen.getByRole("checkbox", { name: /i have read and agree/i }));

    fireEvent.click(screen.getByRole("button", { name: /reserve/i }));
    expect(toast.warning).toHaveBeenCalledWith("Please enter your name.");
    expect(sendMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/Name/i), { target: { value: "Jane" } });
    fireEvent.change(screen.getByPlaceholderText(/Contact Number/i), { target: { value: "555" } });
    fireEvent.change(screen.getByPlaceholderText(/Email/i), { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: /reserve/i }));
    expect(toast.warning).toHaveBeenCalledWith("Please enter a valid email address.");

    fireEvent.change(screen.getByPlaceholderText(/Email/i), { target: { value: "valid@example.com" } });
    mockIsEmailJsConfigured.mockReturnValue(false);
    mockGetMissingEmailJsEnvKeys.mockReturnValue(["VITE_EMAILJS_SERVICE_ID"]);
    fireEvent.click(screen.getByRole("button", { name: /reserve/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ feature: "booking-form", missingKeys: "VITE_EMAILJS_SERVICE_ID" }),
    );
    expect(sendMock).not.toHaveBeenCalled();
  });
});
