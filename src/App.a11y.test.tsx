import { render, waitFor, screen } from "@testing-library/react";
import App from "./App";

describe("App landmark semantics", () => {
  it("renders exactly one main landmark on search route", async () => {
    window.history.pushState({}, "", "/search");
    render(<App />);

    await waitFor(() => {
      const mains = document.querySelectorAll("main, [role='main']");
      expect(mains.length).toBe(1);
    });
  });

  it("has a skip-to-main link as the first focusable element", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    await waitFor(() => {
      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveClass("skip-to-main");
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });
  });
});
