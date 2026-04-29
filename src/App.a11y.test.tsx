import { render, waitFor } from "@testing-library/react";
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
});
