import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toast } from "react-toastify";
import ProfilePage from "./ProfilePage";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));
vi.mock("../tenant/displayBrand", () => ({ getTenantBrandName: () => "Test Brand" }));
vi.mock("../api/client", () => ({ buildApiUrl: (path: string) => path, getApiHeaders: () => ({}) }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const profile = { id: 44, name: "Test Guest", email: "guest@example.test", phone: "+447700900123", photoUrl: "/original.png" };
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }
function png() {
  const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lH0AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
  return new File([bytes], "sample.png", { type: "image/png" });
}
async function renderPage() {
  const view = render(<MemoryRouter initialEntries={["/profile?bookingId=101&t=token"]}><ProfilePage /></MemoryRouter>);
  await settle();
  expect(screen.getByRole("textbox", { name: "Full Name" })).toBeInTheDocument();
  return view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
}
function mockRequests(uploadStatus: number) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") return response({ photoUrl: "/updated.png" }, uploadStatus);
    if (init?.method === "DELETE") return response({});
    return response(profile);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("UXD-2026-10-27-10-A photo upload uncertainty", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => undefined); vi.clearAllMocks(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  test("valid 68-byte PNG / 503 keeps photo and form draft, with no automatic upload retry", async () => {
    const fetchMock = mockRequests(503);
    const fileInput = await renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: "Full Name" }), { target: { value: "Draft Name" } });
    await settle();
    fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), { target: { value: "draft@example.test" } });
    await settle();
    expect(png().size).toBe(68);
    fireEvent.change(fileInput, { target: { files: [png()] } });
    await settle();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("We couldn't upload your photo right now. The upload could not be confirmed. Please try again in a moment.");
    expect(alert).not.toHaveTextContent(/smaller|512/);
    expect(screen.getByRole("textbox", { name: "Full Name" })).toHaveValue("Draft Name");
    expect(screen.getByRole("textbox", { name: /Email/ })).toHaveValue("draft@example.test");
    expect(screen.getByLabelText("Your profile photo").querySelector("img")).toHaveAttribute("src", "/original.png");
    expect(fileInput).toBeEnabled();
    expect(fileInput.value).toBe("");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(toast.success).not.toHaveBeenCalled();
    fireEvent.change(fileInput, { target: { files: [] } });
    await settle();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Full Name" })).toHaveValue("Draft Name");
    fireEvent.change(fileInput, { target: { files: [png()] } });
    await settle();
    screen.getByRole("alert");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Back to booking/ })).toHaveAttribute("href", "/booking/101?t=token");
  });

  test.each([
    ["invalid type", () => new File(["x"], "notes.txt", { type: "text/plain" }), "Please choose a JPG, PNG, or WebP image."],
    ["oversize", () => new File([new Uint8Array(512001)], "large.png", { type: "image/png" }), "Photo must be under 512 KB."],
  ] as const)("%s keeps the existing validation and sends no photo request", async (_name, file, message) => {
    const fetchMock = mockRequests(503);
    const input = await renderPage();
    fireEvent.change(input, { target: { files: [file()] } });
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  test.each([401, 403])("HTTP %i preserves the existing authentication-failure behavior", async (status) => {
    const fetchMock = mockRequests(status);
    fireEvent.change(await renderPage(), { target: { files: [png()] } });
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't upload your photo. Please try a smaller JPG or PNG.");
    expect(screen.getByLabelText("Your profile photo").querySelector("img")).toHaveAttribute("src", "/original.png");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  test("successful upload and deliberate removal retain their original handlers", async () => {
    const fetchMock = mockRequests(200);
    fireEvent.change(await renderPage(), { target: { files: [png()] } });
    await settle();
    expect(toast.success).toHaveBeenCalledWith("Profile photo updated.");
    expect(screen.getByLabelText("Your profile photo").querySelector("img")).toHaveAttribute("src", "/updated.png");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove", exact: true }));
    await settle();
    expect(toast.success).toHaveBeenCalledWith("Profile photo removed.");
    expect(screen.getByLabelText("Profile initials: TG")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(1);
  });
});
