/**
 * @vitest-environment jsdom
 *
 * POS-013 / POS-014 on the guest QR menu: dietary marks and the All / Pure Veg / Jain / Non-Veg chips, allergen badge, and the lazy dish photo.
 */
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import QrMenuPage from "../QrMenuPage";
import { settle } from "@/test/settle";
import { dietaryMarkColor, hasClassifiedDishes, matchesDietaryFilter, normalizeQrDietary } from "../../components/qrmenu/dietary";

const item = (id: number, name: string, dietary: string, extra: Record<string, unknown> = {}) => ({
  id, name, price: 100 + id, dietary, outletCategory: "FNB", isSoldOut86: false, ...extra,
});

const menu = (items: unknown[]) => ({
  tenantName: "Coorg Resort",
  tenantSlug: "coorg-resort",
  currency: "INR",
  roomLabel: "Villa 101",
  listingId: 101,
  categories: [{ categoryKey: "FNB", title: "F&B (Dining & Room Service)", items }],
});

const CLASSIFIED = menu([
  item(1, "Paneer Tikka", "VEG", { allergens: "Dairy", imageUrl: "https://atlashomestorage.blob.core.windows.net/atlas-media/pos-menu/coorg/1/a.jpg" }),
  item(2, "Chicken Curry", "NON_VEG"),
  item(3, "Jain Thali", "JAIN"),
  item(4, "Egg Bhurji", "EGG"),
  item(5, "Dal Fry", "VEGAN"),
  item(6, "Mystery Special", "NA"),
]);

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={["/qr-menu/coorg-resort?room=101"]}>
      <Routes>
        <Route path="/qr-menu/:tenantSlug" element={<QrMenuPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function serve(body: unknown) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/public/qr-menu/coorg-resort?")) return Promise.resolve({ ok: true, status: 200, json: async () => body });
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  }) as never;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(cleanup);

describe("dietary helpers", () => {
  test("the five codes are read, anything else is not classified", () => {
    expect(normalizeQrDietary("veg")).toBe("VEG");
    expect(normalizeQrDietary("Non-Veg")).toBe("NON_VEG");
    expect(normalizeQrDietary("halal")).toBe("NA");
    expect(normalizeQrDietary(undefined)).toBe("NA");
  });

  test("Pure Veg = veg, vegan, jain; Non-Veg = non-veg and egg; Jain = jain; an unclassified dish matches only All", () => {
    const pure = ["VEG", "VEGAN", "JAIN"];
    const non = ["NON_VEG", "EGG"];
    for (const d of pure) expect(matchesDietaryFilter(d, "PURE_VEG")).toBe(true);
    for (const d of [...non, "NA"]) expect(matchesDietaryFilter(d, "PURE_VEG")).toBe(false);
    for (const d of non) expect(matchesDietaryFilter(d, "NON_VEG")).toBe(true);
    for (const d of [...pure, "NA"]) expect(matchesDietaryFilter(d, "NON_VEG")).toBe(false);
    expect(matchesDietaryFilter("JAIN", "JAIN")).toBe(true);
    expect(matchesDietaryFilter("VEG", "JAIN")).toBe(false);
    expect(matchesDietaryFilter("NA", "ALL")).toBe(true);
  });

  test("colours: green for the vegetarian family, red non-veg, amber egg, none when unclassified", () => {
    expect(dietaryMarkColor("VEGAN")).toBe("#16a34a");
    expect(dietaryMarkColor("NON_VEG")).toBe("#dc2626");
    expect(dietaryMarkColor("EGG")).toBe("#d97706");
    expect(dietaryMarkColor("NA")).toBeNull();
  });

  test("chips are worth showing only when something is classified", () => {
    expect(hasClassifiedDishes([{ dietary: "NA" }, {}])).toBe(false);
    expect(hasClassifiedDishes([{ dietary: "NA" }, { dietary: "JAIN" }])).toBe(true);
  });
});

describe("QrMenuPage dietary marks and chips", () => {
  test("each classified dish wears its mark; the unclassified one wears none", async () => {
    serve(CLASSIFIED);
    renderMenu();
    await settle();
    expect(screen.getByTestId("menu-item-dietary-1")).toHaveAttribute("data-dietary", "VEG");
    expect(screen.getByTestId("menu-item-dietary-2")).toHaveAttribute("data-dietary", "NON_VEG");
    expect(screen.getByTestId("menu-item-dietary-4")).toHaveAttribute("data-dietary", "EGG");
    expect(screen.getByTestId("menu-item-dietary-5")).toHaveAttribute("data-dietary", "VEGAN");
    expect(screen.queryByTestId("menu-item-dietary-6")).not.toBeInTheDocument();
  });

  test("Pure Veg shows veg, vegan and jain only; Jain only jain; Non-Veg non-veg and egg; All brings everything back", async () => {
    serve(CLASSIFIED);
    renderMenu();
    await settle();
    const ids = () => [1, 2, 3, 4, 5, 6].filter((i) => screen.queryByTestId(`menu-item-${i}`));

    expect(ids()).toEqual([1, 2, 3, 4, 5, 6]);
    fireEvent.click(screen.getByTestId("qr-dietary-chip-PURE_VEG"));
    expect(ids()).toEqual([1, 3, 5]);
    fireEvent.click(screen.getByTestId("qr-dietary-chip-JAIN"));
    expect(ids()).toEqual([3]);
    fireEvent.click(screen.getByTestId("qr-dietary-chip-NON_VEG"));
    expect(ids()).toEqual([2, 4]);
    fireEvent.click(screen.getByTestId("qr-dietary-chip-ALL"));
    expect(ids()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("a filter with no matching dish says so and offers All", async () => {
    serve(menu([item(1, "Paneer Tikka", "VEG"), item(2, "Mystery", "NA")]));
    renderMenu();
    await settle();
    fireEvent.click(screen.getByTestId("qr-dietary-chip-JAIN"));
    expect(screen.getByTestId("qr-dietary-empty")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("qr-dietary-chip-ALL"));
    expect(screen.queryByTestId("qr-dietary-empty")).not.toBeInTheDocument();
  });

  test("a menu nobody has classified shows no chips and no marks (the menu never guesses)", async () => {
    serve(menu([item(1, "Paneer Tikka", "NA"), item(2, "Chicken Curry", "NA")]));
    renderMenu();
    await settle();
    expect(screen.queryByTestId("qr-dietary-chips")).not.toBeInTheDocument();
    expect(screen.queryByTestId("menu-item-dietary-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("menu-item-1")).toBeInTheDocument();
  });

  test("the allergen badge appears only on the dish that declares one", async () => {
    serve(CLASSIFIED);
    renderMenu();
    await settle();
    expect(screen.getByTestId("menu-item-allergens-1")).toHaveTextContent("Contains: Dairy");
    expect(screen.queryByTestId("menu-item-allergens-2")).not.toBeInTheDocument();
  });
});

describe("QrMenuPage dish photos", () => {
  test("a dish with a photo shows it lazy-loaded at a fixed size; a dish without one shows none", async () => {
    serve(CLASSIFIED);
    renderMenu();
    await settle();
    const box = screen.getByTestId("menu-item-photo-1");
    const img = within(box).getByAltText("Paneer Tikka");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width", "72");
    expect(img).toHaveAttribute("height", "72");
    expect(screen.queryByTestId("menu-item-photo-2")).not.toBeInTheDocument();
  });

  test("a photo from a host we do not trust (not our file store) is not shown", async () => {
    serve(menu([item(1, "Paneer Tikka", "VEG", { imageUrl: "https://evil.blob.core.windows.net/x/a.jpg" })]));
    renderMenu();
    await settle();
    expect(screen.queryByTestId("menu-item-photo-1")).not.toBeInTheDocument();
  });
});
