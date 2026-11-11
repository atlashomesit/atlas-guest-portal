import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWifiQrPayload, CopyButton, CopyableInfoRow, escapeWifiQrValue, WifiScanToConnect } from "./StayAccessCopy";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GUEST-039 Wi-Fi QR payload", () => {
  it("is the standard WIFI:S:<ssid>;T:WPA;P:<password>;; string", () => {
    expect(buildWifiQrPayload("LakeLoft-Guest", "pass-1234")).toBe("WIFI:S:LakeLoft-Guest;T:WPA;P:pass-1234;;");
  });

  it("backslash-escapes the reserved characters \\ ; , : \" so an awkward password still scans", () => {
    expect(escapeWifiQrValue('a;b,c:d"e\\f')).toBe('a\\;b\\,c\\:d\\"e\\\\f');
    expect(buildWifiQrPayload("My;Net", 'p:w"d')).toBe('WIFI:S:My\\;Net;T:WPA;P:p\\:w\\"d;;');
  });

  it("uses T:nopass for an open network", () => {
    expect(buildWifiQrPayload("Cafe", "")).toBe("WIFI:S:Cafe;T:nopass;;");
    expect(buildWifiQrPayload("Cafe", null)).toBe("WIFI:S:Cafe;T:nopass;;");
  });
});

describe("GUEST-039 CopyButton", () => {
  it("copies the value, shows 'Copied! ✓' for 2 seconds, then goes back", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyButton value="pass-1234" ariaLabel="Copy Wi-Fi password" testId="copy-pw" />);
    const btn = screen.getByTestId("copy-pw");
    expect(btn).toHaveTextContent("Copy");
    await act(async () => { fireEvent.click(btn); });
    expect(writeText).toHaveBeenCalledWith("pass-1234");
    expect(screen.getByTestId("copy-pw")).toHaveTextContent("Copied! ✓");
    await act(async () => { vi.advanceTimersByTime(1999); });
    expect(screen.getByTestId("copy-pw")).toHaveTextContent("Copied! ✓");
    await act(async () => { vi.advanceTimersByTime(2); });
    expect(screen.getByTestId("copy-pw")).toHaveTextContent("Copy");
    expect(screen.getByTestId("copy-pw")).not.toHaveTextContent("Copied");
  });

  it("never claims 'Copied' when both the clipboard API and the fallback fail", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    (document as unknown as { execCommand: () => boolean }).execCommand = () => false;
    render(<CopyButton value="x" ariaLabel="Copy" testId="copy-x" />);
    await act(async () => { fireEvent.click(screen.getByTestId("copy-x")); });
    expect(screen.getByTestId("copy-x")).not.toHaveTextContent("Copied");
  });

  it("CopyableInfoRow renders the value, a Copy Code label and nothing when the value is empty", () => {
    const { rerender } = render(
      <CopyableInfoRow label="Door code" value="5678" mono copyLabel="Copy Code" copyAriaLabel="Copy door code" copyTestId="copy-door-code-btn" valueTestId="door-code-value" />,
    );
    expect(screen.getByTestId("door-code-value")).toHaveTextContent("5678");
    expect(screen.getByTestId("copy-door-code-btn")).toHaveTextContent("Copy Code");
    rerender(<CopyableInfoRow label="Door code" value="" copyAriaLabel="x" copyTestId="copy-door-code-btn" />);
    expect(screen.queryByTestId("copy-door-code-btn")).toBeNull();
  });
});

describe("GUEST-039 WifiScanToConnect", () => {
  it("shows a 'Scan to Connect' button that reveals a QR carrying the WIFI: payload", () => {
    render(<WifiScanToConnect ssid="LakeLoft-Guest" passphrase="pass-1234" />);
    expect(screen.queryByTestId("wifi-qr-card")).toBeNull();
    fireEvent.click(screen.getByTestId("wifi-scan-to-connect-btn"));
    expect(screen.getByTestId("wifi-qr-card").querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("wifi-qr-payload")).toHaveAttribute("data-payload", "WIFI:S:LakeLoft-Guest;T:WPA;P:pass-1234;;");
  });

  it("renders nothing without a network name", () => {
    const { container } = render(<WifiScanToConnect ssid="" passphrase="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
