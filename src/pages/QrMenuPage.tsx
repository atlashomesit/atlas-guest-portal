import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Utensils,
  Sparkles,
  Car,
  ShoppingBag,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Plus,
  Minus,
  MessageSquare,
  ArrowRight,
  Receipt,
  Smartphone,
} from "lucide-react";
import { buildApiUrl, getApiHeaders } from "../api/client";
import SEO from "../components/SEO";
import ModifierPicker from "../components/qrmenu/ModifierPicker";
import OptimizedImage from "../components/ui/OptimizedImage";
import { sanitizeGuestImageUrl } from "../utils/guestImageUrl";
import {
  DIETARY_FILTER_CHIPS,
  dietaryMarkColor,
  dietaryMarkLabel,
  hasClassifiedDishes,
  matchesDietaryFilter,
  type DietaryFilterKey,
} from "../components/qrmenu/dietary";
import QrPayNow from "../components/qrmenu/QrPayNow";
import { canPayNow } from "../components/qrmenu/payNow";
import {
  buildLineKey,
  describeModifiers,
  isOrderable,
  parseModifierGroups,
  selectedModifiers,
  selectionToPayload,
  unitPriceWithModifiers,
  type ModifierGroup,
  type ModifierPick,
  type ModifierSelection,
  type SelectedModifier,
} from "../components/qrmenu/modifiers";

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price: number;
  priceType?: string;
  category?: string;
  outletCategory?: string;
  /** POS-013: the host's classification; "NA" = not classified (no mark is shown). */
  dietary?: "VEG" | "NON_VEG" | "EGG" | "VEGAN" | "JAIN" | "NA";
  /** POS-013: allergens the host declared for the dish (free text). */
  allergens?: string | null;
  sacCode?: string;
  gstRatePercent?: number;
  isTaxInclusive?: boolean;
  isSoldOut86?: boolean;
  /** POS-014: the dish photo (https). */
  imageUrl?: string | null;
  /** POS-017: modifier groups the guest can pick from (the API sends only the available options). Read through parseModifierGroups. */
  modifierGroups?: unknown;
}

export interface MenuCategory {
  categoryKey: string;
  title: string;
  items: MenuItem[];
}

export interface MenuResponse {
  tenantName: string;
  tenantSlug: string;
  brandColor?: string;
  logoUrl?: string;
  currency: string;
  roomLabel?: string | null;
  listingId?: number | null;
  tableCode?: string;
  /**
   * POS-011: what the room link in the URL turned out to be. NONE (no room), KEY (room key accepted), LEGACY (old numeric link, still
   * inside its 30-day window), EXPIRED (old numeric link past the window), INVALID (key not recognised). Absent on an older API.
   */
  roomLinkStatus?: "NONE" | "KEY" | "LEGACY" | "EXPIRED" | "INVALID";
  /** POS-011: the API's friendly "ask the front desk" text for EXPIRED / INVALID. */
  roomLinkMessage?: string | null;
  legacyLinkExpiresAtUtc?: string | null;
  /** POS-011: too many wrong phone last-4 / PIN tries for this room - room charge is paused until roomChargeLockedUntilUtc. */
  roomChargeLocked?: boolean;
  roomChargeLockedUntilUtc?: string | null;
  /** POS-011: the settlement methods to offer while room charge is locked or the link is unusable (empty = room charge available). */
  roomChargeFallbackMethods?: string[];
  categories: MenuCategory[];
}

export interface OrderStatus {
  orderNumber: string;
  status: string;
  liveStep: "Scheduled" | "Order Received" | "Preparing in Kitchen" | "Out for Delivery" | "Served";
  targetLabel: string;
  settlementMethod: string;
  totalAmount: number;
  gstAmount: number;
  /** POS-067: what the guest still owes on the order (the API's figure). Pay now is offered only while it is above 0. */
  amountDue?: number;
  createdAtUtc: string;
  estimatedMinutes: number;
  /** POS-062: "TAKEAWAY" for a pickup order; absent / null for a table, room or counter order. The API never returns the customer's name or phone. */
  orderType?: string | null;
  kotNumber?: string;
  kotStatus?: string;
  /** POS-003: UTC serve-at time of a "Schedule for Later" order; absent for as soon as possible. */
  scheduledFor?: string | null;
  whatsAppUpdates?: boolean;
  lines: Array<{
    id?: number;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    /** POS-017: item price before the chosen modifier deltas (unitPrice already includes them). */
    baseUnitPrice?: number;
    /** POS-017: the API's text for the guest's choices, e.g. "Milk choice: Oat milk (+₹40.00)". */
    modifiersText?: string | null;
  }>;
}

/** POS-017: one line of the guest's cart - the item plus the choices that make it a distinct line. */
interface CartLine {
  key: string;
  item: MenuItem;
  qty: number;
  notes: string;
  picks: ModifierPick[];
  modifiers: SelectedModifier[];
  /** Menu price + the chosen deltas, as the API will price it (display only; the server recomputes). */
  unitPrice: number;
}

/** POS-011: the same wording the API uses when a room link is not usable. */
const ASK_FRONT_DESK_MESSAGE = "This room's QR link is no longer valid. Please ask the front desk for the current QR code.";
const ROOM_LOCK_MESSAGE =
  "Too many wrong codes were tried for this room, so charging it to the room is paused. Please pay now or pay on delivery, or ask the front desk.";

/** "3:45 PM" in the guest's own clock; null when the API gave no usable time. */
function formatRetryTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

const formatRupees = (amount: number): string => amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });

const FALLBACK_MENU: MenuResponse = {
  tenantName: "Homestay & Resorts",
  tenantSlug: "demo-resort",
  currency: "INR",
  brandColor: "#9e402a",
  categories: [
    {
      categoryKey: "FNB",
      title: "F&B (Dining & Room Service)",
      items: [
        {
          id: 101,
          name: "Fresh Farm Omelette & Toast",
          description: "Free-range eggs with herb butter, grilled tomatoes, and toasted multigrain sourdough.",
          price: 240,
          dietary: "NON_VEG",
          outletCategory: "FNB",
          isSoldOut86: false,
        },
        {
          id: 102,
          name: "South Indian Filter Coffee",
          description: "Freshly brewed estate arabica-robusta blend with frothy milk and jaggery.",
          price: 120,
          dietary: "VEG",
          outletCategory: "FNB",
          isSoldOut86: false,
        },
        {
          id: 103,
          name: "Estate Pandi Curry with Akki Roti",
          description: "Signature Coorg spiced pork curry served with 3 soft steamed rice rotis.",
          price: 480,
          dietary: "NON_VEG",
          outletCategory: "FNB",
          isSoldOut86: false,
        },
      ],
    },
    {
      categoryKey: "EXPERIENCE",
      title: "Experiences & Activities",
      items: [
        {
          id: 201,
          name: "Guided Coffee Plantation Walk",
          description: "90-minute walk through the coffee and black pepper trails with our resident planter.",
          price: 600,
          dietary: "NA",
          outletCategory: "EXPERIENCE",
          isSoldOut86: false,
        },
        {
          id: 202,
          name: "Private Campfire & Barbecue Setup",
          description: "Evening bonfire in your private garden with marinated paneer/chicken skewers.",
          price: 1500,
          dietary: "NA",
          outletCategory: "EXPERIENCE",
          isSoldOut86: false,
        },
      ],
    },
    {
      categoryKey: "TRANSPORT",
      title: "Transport & Pickups",
      items: [
        {
          id: 301,
          name: "Airport / Railway Station Transfer",
          description: "Private air-conditioned sedan transfer to/from nearest transit hub.",
          price: 2800,
          dietary: "NA",
          outletCategory: "TRANSPORT",
          isSoldOut86: false,
        },
      ],
    },
    {
      categoryKey: "RETAIL",
      title: "Retail & Minibar",
      items: [
        {
          id: 401,
          name: "Estate Artisanal Honey (350g)",
          description: "100% pure raw unprocessed forest honey harvested from estate apiaries.",
          price: 420,
          dietary: "VEG",
          outletCategory: "RETAIL",
          isSoldOut86: false,
        },
      ],
    },
  ],
};

// POS-003: "Fulfill At" slots. Times are the guest's local clock; the API receives UTC.
type FulfillAtMode = "NOW" | "LUNCH" | "HIGH_TEA" | "DINNER" | "CUSTOM";
const FULFILL_SLOTS: { mode: Exclude<FulfillAtMode, "NOW" | "CUSTOM">; label: string; time: string }[] = [
  { mode: "LUNCH", label: "Lunch 1:30 PM", time: "13:30" },
  { mode: "HIGH_TEA", label: "High Tea 5:00 PM", time: "17:00" },
  { mode: "DINNER", label: "Dinner 8:30 PM", time: "20:30" },
];

/** null = as soon as possible; undefined = a custom time was chosen but is missing/invalid; else the next local occurrence as UTC ISO. */
function resolveFulfillAtIso(mode: FulfillAtMode, customTime: string, now: Date = new Date()): string | null | undefined {
  if (mode === "NOW") return null;
  const time = mode === "CUSTOM" ? customTime : FULFILL_SLOTS.find((s) => s.mode === mode)?.time ?? "";
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) return undefined;
  const target = new Date(now);
  target.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.toISOString();
}

export default function QrMenuPage() {
  const { tenantSlug = "atlas" } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();

  // POS-011: the printed room QR is `?rk=<opaque key>`. The old numeric `?room=<listingId>` keeps working while the API allows it.
  const roomKeyParam = searchParams.get("rk")?.trim() || undefined;
  const roomParam = searchParams.get("room");
  const parsedRoom = roomParam ? parseInt(roomParam, 10) : NaN;
  const urlListingId = Number.isFinite(parsedRoom) && parsedRoom > 0 ? parsedRoom : undefined;
  const tableCode = searchParams.get("table") || undefined;
  const orderParam = searchParams.get("order");

  const [_loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [_error, setError] = useState<string | null>(null);
  // POS-011: bumped only by the guest's own "Check again" tap, to re-read the menu (and with it the room lock).
  const [menuReloadNonce, setMenuReloadNonce] = useState(0);
  // POS-011: set by a 403 ROOM_CHARGE_LOCKED / ROOM_LINK_EXPIRED / ROOM_LINK_INVALID on the order itself.
  const [roomLock, setRoomLock] = useState<{ until: string | null; message: string } | null>(null);
  const [roomLinkProblem, setRoomLinkProblem] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Which room (if any) this page may charge to. A room key is resolved by the API; a legacy numeric link is trusted from the URL
  // until the API says otherwise. An expired / unknown link has no room at all.
  const menuLinkStatus = menu?.roomLinkStatus;
  const roomLinkBroken = roomLinkProblem !== null || menuLinkStatus === "EXPIRED" || menuLinkStatus === "INVALID";
  const roomLinkNoticeText = roomLinkBroken ? roomLinkProblem ?? (menu?.roomLinkMessage || ASK_FRONT_DESK_MESSAGE) : null;
  const menuListingId = typeof menu?.listingId === "number" && menu.listingId > 0 ? menu.listingId : undefined;
  const listingId = roomLinkBroken ? undefined : roomKeyParam ? menuListingId : menuListingId ?? urlListingId;
  const activeLock = roomLock ?? (menu?.roomChargeLocked === true ? { until: menu.roomChargeLockedUntilUtc ?? null, message: ROOM_LOCK_MESSAGE } : null);
  const roomChargeAvailable = Boolean(listingId) && activeLock === null;
  // While room charge is unavailable the API names the methods to offer; an empty list means no restriction.
  const menuFallbackMethods = menu?.roomChargeFallbackMethods;
  const fallbackList = !roomChargeAvailable && Array.isArray(menuFallbackMethods) ? menuFallbackMethods : [];
  const restrictFallback = fallbackList.includes("PAY_NOW_UPI") || fallbackList.includes("PAY_ON_DELIVERY");
  const offerPayNow = !restrictFallback || fallbackList.includes("PAY_NOW_UPI");
  const offerPayOnDelivery = !restrictFallback || fallbackList.includes("PAY_ON_DELIVERY");

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  // POS-013: dietary chip (All / Pure Veg / Jain / Non-Veg). Narrows what is shown; the order cart is untouched.
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilterKey>("ALL");

  // Cart: line key (item id, plus the chosen modifiers when it has any) -> line
  const [cart, setCart] = useState<{ [lineKey: string]: CartLine }>({});
  // POS-017: the item whose modifier picker is open
  const [pickerItemId, setPickerItemId] = useState<number | null>(null);

  // Checkout Form State
  // POS-047 L3: an optional host promo code typed on the order. The server checks it and takes the amount off the food bill before GST.
  const [promoCode, setPromoCode] = useState("");
  const [settlementMethod, setSettlementMethod] = useState<"POST_TO_ROOM" | "PAY_NOW_UPI" | "PAY_ON_DELIVERY">(
    listingId ? "POST_TO_ROOM" : "PAY_NOW_UPI"
  );

  useEffect(() => {
    setSettlementMethod((prev) => {
      if (roomChargeAvailable) return "POST_TO_ROOM";
      if (prev === "PAY_NOW_UPI" && offerPayNow) return prev;
      if (prev === "PAY_ON_DELIVERY" && offerPayOnDelivery) return prev;
      return offerPayNow ? "PAY_NOW_UPI" : "PAY_ON_DELIVERY";
    });
  }, [roomChargeAvailable, offerPayNow, offerPayOnDelivery]);
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [guestName, setGuestName] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("");
  // POS-062: takeaway PICKUP is offered on the plain menu link only (no room, no table), where today's order is a counter walk-in. It is paid at the
  // counter when collecting; delivery is deliberately not offered here (the API refuses it from an anonymous caller).
  const takeawayOffered = !roomKeyParam && !urlListingId && !tableCode && !listingId;
  const [takeaway, setTakeaway] = useState<boolean>(false);
  const takeawayActive = takeawayOffered && takeaway;
  const [whatsAppUpdates, setWhatsAppUpdates] = useState<boolean>(true);
  const [orderNotes, setOrderNotes] = useState<string>("");
  // POS-003: "Fulfill At" - as soon as possible, or a time slot / custom time later (local clock).
  const [fulfillAt, setFulfillAt] = useState<FulfillAtMode>("NOW");
  const [customFulfillTime, setCustomFulfillTime] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Live order tracker
  const [activeOrder, setActiveOrder] = useState<OrderStatus | null>(null);
  // POS-067: set when verify-payment settled the order, so the "Payment received" note stays after the reloaded order no longer owes anything.
  const [paidNow, setPaidNow] = useState(false);

  // Fetch menu on load
  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams();
        // POS-011: the room key wins; the numeric link is only sent when there is no key.
        if (roomKeyParam) query.set("rk", roomKeyParam);
        else if (urlListingId) query.set("room", urlListingId.toString());
        if (tableCode) query.set("table", tableCode);

        const url = buildApiUrl(`/api/public/qr-menu/${encodeURIComponent(tenantSlug)}?${query.toString()}`);
        const res = await fetch(url, {
          headers: getApiHeaders(tenantSlug),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data: MenuResponse = await res.json();
        if (!cancelled) {
          setMenu(data);
        }
      } catch {
        if (!cancelled) {
          // Graceful fallback with room/table context
          setMenu({
            ...FALLBACK_MENU,
            tenantSlug,
            roomLabel: urlListingId ? `Room / Villa ${urlListingId}` : undefined,
            listingId: urlListingId,
            tableCode,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMenu();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, roomKeyParam, urlListingId, tableCode, menuReloadNonce]);

  // If order param is provided, load initial order tracking
  useEffect(() => {
    if (!orderParam) return;
    let cancelled = false;

    async function loadOrder() {
      try {
        const url = buildApiUrl(`/api/public/qr-menu/${encodeURIComponent(tenantSlug)}/order/${encodeURIComponent(orderParam!)}`);
        const res = await fetch(url, { headers: getApiHeaders(tenantSlug) });
        if (res.ok) {
          const data: OrderStatus = await res.json();
          if (!cancelled) setActiveOrder(data);
        }
      } catch {
        // Ignored
      }
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, orderParam]);

  // POS-067: after a verified payment, re-read the order so the tracker shows it as paid.
  const reloadActiveOrder = async () => {
    if (!activeOrder) return;
    try {
      const res = await fetch(buildApiUrl(`/api/public/qr-menu/${encodeURIComponent(tenantSlug)}/order/${encodeURIComponent(activeOrder.orderNumber)}`), { headers: getApiHeaders(tenantSlug) });
      if (res.ok) setActiveOrder(await res.json());
    } catch {
      /* the next poll picks it up */
    }
  };

  // Polling tracker for active order
  useEffect(() => {
    if (!activeOrder || activeOrder.liveStep === "Served") return;

    const interval = setInterval(async () => {
      try {
        const url = buildApiUrl(`/api/public/qr-menu/${encodeURIComponent(tenantSlug)}/order/${encodeURIComponent(activeOrder.orderNumber)}`);
        const res = await fetch(url, { headers: getApiHeaders(tenantSlug) });
        if (res.ok) {
          const data: OrderStatus = await res.json();
          setActiveOrder(data);
        }
      } catch {
        // Suppress polling error
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeOrder, tenantSlug]);

  /** POS-017: add one unit of the item with the given choices; the same choices land on the same line, other choices make a new line. */
  const addLine = (item: MenuItem, picks: ModifierPick[] = [], modifiers: SelectedModifier[] = []) => {
    if (item.isSoldOut86) return;
    const key = buildLineKey(item.id, picks);
    setCart((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: existing
          ? { ...existing, qty: existing.qty + 1 }
          : { key, item, qty: 1, notes: "", picks, modifiers, unitPrice: unitPriceWithModifiers(item.price, modifiers) },
      };
    });
  };

  const handleAddToCart = (item: MenuItem) => {
    if (item.isSoldOut86) return;
    const groups = parseModifierGroups(item.modifierGroups);
    if (groups.length === 0) {
      addLine(item);
      return;
    }
    // An item with choices opens its picker; a group nobody can satisfy cannot be ordered at all.
    if (!isOrderable(groups)) return;
    setPickerItemId((current) => (current === item.id ? null : item.id));
  };

  const handlePickerAdd = (item: MenuItem, groups: ModifierGroup[], selection: ModifierSelection) => {
    addLine(item, selectionToPayload(groups, selection), selectedModifiers(groups, selection));
    setPickerItemId(null);
  };

  const handleAdjustQty = (lineKey: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[lineKey];
      if (!existing) return prev;
      const newQty = existing.qty + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[lineKey];
        return copy;
      }
      return {
        ...prev,
        [lineKey]: {
          ...existing,
          qty: newQty,
        },
      };
    });
  };

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  // Display total only: menu price + chosen deltas per unit, summed in paise. The API prices and taxes the order itself.
  const cartSubtotal = useMemo(
    () => cartLines.reduce((acc, line) => acc + Math.round(line.unitPrice * 100) * line.qty, 0) / 100,
    [cartLines]
  );
  const cartCount = useMemo(
    () => cartLines.reduce((acc, line) => acc + line.qty, 0),
    [cartLines]
  );

  // The order sheet is fixed to the bottom of the screen and can take most of it. The page reserves exactly its height below the menu, so a
  // guest can always scroll the next dish (or the last one) up into the strip above the sheet and add another line.
  const orderSheetRef = useRef<HTMLFormElement | null>(null);
  const [orderSheetHeight, setOrderSheetHeight] = useState(0);
  const orderSheetOpen = cartCount > 0;
  useEffect(() => {
    const sheet = orderSheetRef.current;
    if (!orderSheetOpen || !sheet) {
      setOrderSheetHeight(0);
      return undefined;
    }
    const measure = () => setOrderSheetHeight(sheet.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [orderSheetOpen]);

  // Submit Order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartLines.length === 0) return;

    setVerificationError(null);
    const scheduledForIso = resolveFulfillAtIso(fulfillAt, customFulfillTime);
    if (scheduledForIso === undefined) {
      setVerificationError("Please pick the time you would like your order served, or choose 'As soon as possible'.");
      return;
    }
    // POS-062: a pickup order needs a name and a mobile number so the kitchen can call the guest (the API checks again).
    if (takeawayActive && (!guestName.trim() || guestPhone.replace(/\D/g, "").length < 10)) {
      setVerificationError("Please enter your name and a 10-digit mobile number so we can call you when your order is ready.");
      return;
    }
    setSubmitting(true);
    setAttemptsRemaining(null);

    try {
      const payload = {
        listingId,
        tableCode,
        // POS-062: only the choice goes up - the server prices the order and the page never names a fee, a packaging charge or an address.
        orderType: takeawayActive ? "TAKEAWAY" : undefined,
        settlementMethod: takeawayActive ? "PAY_ON_DELIVERY" : settlementMethod,
        // POS-011: the room key from the printed QR; only a room charge needs it, and a legacy numeric link has none.
        roomKey: settlementMethod === "POST_TO_ROOM" ? roomKeyParam : undefined,
        verificationCode: settlementMethod === "POST_TO_ROOM" ? verificationCode.trim() : undefined,
        // POS-047 L3: only the code goes up; a room charge refuses a promo code on the server, so none is sent with one.
        promoCode: settlementMethod !== "POST_TO_ROOM" && promoCode.trim() ? promoCode.trim().toUpperCase() : undefined,
        guestName: guestName.trim() || undefined,
        guestPhone: guestPhone.trim() || undefined,
        whatsAppUpdates,
        notes: orderNotes.trim() || undefined,
        scheduledFor: scheduledForIso ?? undefined,
        lines: cartLines.map((l) => ({
          addOnServiceId: l.item.id,
          itemName: l.item.name,
          quantity: l.qty,
          // The menu price, as before: the server prices the line itself (menu price + the chosen deltas) and ignores this.
          unitPrice: l.item.price,
          gstRatePercent: l.item.gstRatePercent ?? 5,
          notes: l.notes.trim() || undefined,
          // POS-017: ids only; the API checks them against the item's groups and prices them from the catalogue.
          modifiers: l.picks.length > 0 ? l.picks : undefined,
        })),
      };

      const url = buildApiUrl(`/api/public/qr-menu/${encodeURIComponent(tenantSlug)}/order`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...getApiHeaders(tenantSlug),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        if (errorData?.code === "ROOM_CHARGE_LOCKED") {
          // POS-011: too many wrong codes for this room. Show when it ends and offer the other ways to pay. The order is NOT
          // re-sent: the guest chooses Pay Now / Pay on Delivery, or taps "Check again" later.
          let until: string | null = typeof errorData.lockedUntilUtc === "string" ? errorData.lockedUntilUtc : null;
          if (!until) {
            const headerSeconds = Number(res.headers?.get?.("Retry-After"));
            const seconds = typeof errorData.retryAfterSeconds === "number" ? errorData.retryAfterSeconds : headerSeconds;
            if (Number.isFinite(seconds) && seconds > 0) until = new Date(Date.now() + seconds * 1000).toISOString();
          }
          setRoomLock({ until, message: errorData.error || ROOM_LOCK_MESSAGE });
          setVerificationCode("");
          return;
        }
        if (errorData?.code === "ROOM_LINK_EXPIRED" || errorData?.code === "ROOM_LINK_INVALID") {
          setRoomLinkProblem(errorData.error || ASK_FRONT_DESK_MESSAGE);
          return;
        }
        if (res.status === 403 || errorData?.code === "ROOM_VERIFICATION_FAILED") {
          if (typeof errorData?.attemptsRemaining === "number") setAttemptsRemaining(errorData.attemptsRemaining);
          setVerificationError(
            errorData?.error ||
              "Room verification failed: Room does not have an active CheckedIn booking today or phone last-4 / PIN did not match. Please verify your details or choose 'Pay Now' / 'Pay at Delivery'."
          );
          return;
        }
        throw new Error(errorData?.error || `Order failed (${res.status})`);
      }

      const orderData: OrderStatus = await res.json();
      setActiveOrder(orderData);
      setPromoCode("");
      setCart({});
      setFulfillAt("NOW");
      setCustomFulfillTime("");
    } catch (err: any) {
      setVerificationError(err?.message || "Failed to submit order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter items
  const allCategories = menu?.categories || [];
  const isKnownInvalidCode = verificationCode.trim() === "0000";
  const showVerificationWarning = isKnownInvalidCode || Boolean(verificationError);
  const visibleCategories = useMemo(() => {
    if (selectedCategory === "ALL") return allCategories;
    return allCategories.filter((c) => c.categoryKey === selectedCategory);
  }, [allCategories, selectedCategory]);

  const showDietaryChips = useMemo(
    () => hasClassifiedDishes(allCategories.flatMap((c) => c.items.filter((i) => !i.isSoldOut86))),
    [allCategories],
  );

  const targetHeading =
    menu?.roomLabel || (listingId ? `Room ${listingId}` : tableCode ? `Table ${tableCode}` : "Digital Self-Order Menu");

  // POS-011: a lock is only ever lifted by the guest asking again - we re-read the menu (which carries the lock) and never re-send an order.
  const recheckRoomLock = () => {
    setRoomLock(null);
    setMenuReloadNonce((n) => n + 1);
  };

  const lockRetryTime = formatRetryTime(activeLock?.until);
  const roomNotice = roomLinkNoticeText ? (
    <div
      role="status"
      style={{
        backgroundColor: "#fffbeb",
        border: "1px solid #fde68a",
        color: "#92400e",
        padding: "10px 12px",
        borderRadius: "10px",
        fontSize: "12px",
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        marginBottom: "14px",
      }}
      data-testid="pos-qr-room-link-notice"
    >
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
      <span>{roomLinkNoticeText} You can still order here and choose Pay Now (UPI) or Pay on Delivery.</span>
    </div>
  ) : activeLock ? (
    <div
      role="alert"
      style={{
        backgroundColor: "#fffbeb",
        border: "1px solid #fde68a",
        color: "#92400e",
        padding: "10px 12px",
        borderRadius: "10px",
        fontSize: "12px",
        marginBottom: "14px",
      }}
      data-testid="pos-qr-room-locked-notice"
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
        <span>
          {activeLock.message}
          {lockRetryTime ? ` You can try charging to the room again after ${lockRetryTime}.` : ""}
        </span>
      </div>
      <button
        type="button"
        onClick={recheckRoomLock}
        style={{
          marginTop: "8px",
          backgroundColor: "#fff",
          border: "1px solid #d97706",
          color: "#92400e",
          borderRadius: "6px",
          padding: "5px 10px",
          fontWeight: 700,
          fontSize: "12px",
          cursor: "pointer",
        }}
        data-testid="pos-qr-room-lock-recheck"
      >
        Check again
      </button>
    </div>
  ) : null;

  const payMethodCount = (roomChargeAvailable ? 1 : 0) + (offerPayNow ? 1 : 0) + (offerPayOnDelivery ? 1 : 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fdfbf7",
        fontFamily: "inherit",
        color: "#2d2a26",
        paddingBottom: `${Math.max(120, orderSheetHeight + 24)}px`,
      }}
      data-testid="pos-qr-menu-page"
    >
      <SEO
        title={`${menu?.tenantName || "Atlas"} — QR Menu & Self Ordering`}
        description="Browse the digital menu, place orders to kitchen, and track live preparation status."
      />

      {/* Top Banner / Hero */}
      <header
        style={{
          background: "linear-gradient(135deg, #2b1f1d 0%, #171211 100%)",
          color: "#fff",
          padding: "24px 20px 20px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span
              style={{
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                color: "#d97736",
              }}
            >
              {menu?.tenantName || "Atlas Hospitality"}
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "12px",
                backgroundColor: "rgba(255,255,255,0.15)",
                fontWeight: 600,
              }}
            >
              Live Digital Menu
            </span>
          </div>

          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              margin: "0 0 6px 0",
              letterSpacing: "-0.02em",
            }}
          >
            {targetHeading}
          </h1>

          <p style={{ margin: 0, fontSize: "14px", color: "#e5ded7" }}>
            Order fresh in-house dining, bonfire experiences, or transfers straight to your stay.
          </p>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: "680px", margin: "0 auto", padding: "16px" }}>
        {/* POS-011: room link expired / unknown, or room charge paused: say so before the guest fills a cart */}
        {cartCount === 0 && roomNotice}
        {/* Pre-order room verification strip when room is provided and cart is not yet filled */}
        {roomChargeAvailable && cartCount === 0 && (
          <div
            style={{
              backgroundColor: "#fdf8f6",
              border: "1px solid #ebd9c8",
              padding: "14px 16px",
              borderRadius: "12px",
              marginBottom: "20px",
            }}
            data-testid="pos-qr-room-preverify-strip"
          >
            <label
              style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1e1b18", marginBottom: "4px" }}
            >
              Security Verification for {targetHeading}:
            </label>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#786a63" }}>
              Enter the last 4 digits of your booking&apos;s registered phone number OR 4-digit Stay PIN to charge dining to your room.
            </p>
            <input
              type="text"
              maxLength={8}
              placeholder="e.g. 4829 or Stay PIN"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                fontWeight: 600,
                boxSizing: "border-box",
              }}
              data-testid="pos-qr-verification-input"
            />
            {isKnownInvalidCode && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginTop: "8px",
                }}
                data-testid="pos-qr-room-invalid-alert-pre"
              >
                <AlertCircle size={14} />
                <span>
                  Phone last-4 or Stay PIN does not match active CheckedIn booking for this room. Please Pay Now via UPI or pay online upfront.
                </span>
              </div>
            )}
            <button
              type="button"
              disabled
              style={{ display: "none" }}
              data-testid="pos-qr-charge-to-room-disabled"
            >
              Post to Room
            </button>
          </div>
        )}
        {/* If an active order exists, render the Live Tracker */}
        {activeOrder ? (
          <section
            style={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              padding: "24px 20px",
              border: "1px solid #ebd9c8",
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
              marginBottom: "24px",
            }}
            data-testid="pos-qr-live-tracker"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "12px", color: "#8a7b73", textTransform: "uppercase", fontWeight: 700 }}>
                  Order Placed Successfully
                </span>
                <h2 style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: 800 }}>
                  {activeOrder.orderNumber}
                </h2>
              </div>
              <span
                style={{
                  backgroundColor: "#ecfdf5",
                  color: "#065f46",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Clock size={14} /> Est. {activeOrder.estimatedMinutes} mins
              </span>
            </div>

            {activeOrder.liveStep === "Scheduled" && (
              <div
                style={{ margin: "12px 0", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#eff6ff", color: "#1e40af", fontSize: "13px" }}
                data-testid="pos-qr-scheduled-note"
              >
                Scheduled for{" "}
                <strong>
                  {activeOrder.scheduledFor
                    ? new Date(activeOrder.scheduledFor).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" })
                    : "later"}
                </strong>
                . The kitchen starts preparing shortly before that time.
              </div>
            )}

            {/* Live Status Tracker Step progression */}
            <div style={{ margin: "24px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                {(["Order Received", "Preparing in Kitchen", "Out for Delivery", "Served"] as const).map(
                  (step, idx) => {
                    const stepOrder = ["Order Received", "Preparing in Kitchen", "Out for Delivery", "Served"];
                    const currentIdx = stepOrder.indexOf(activeOrder.liveStep);
                    const isDone = currentIdx >= idx;
                    const isActive = activeOrder.liveStep === step;

                    return (
                      <div
                        key={step}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                          flex: 1,
                          zIndex: 2,
                        }}
                        data-testid={`tracker-step-${idx}`}
                      >
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            backgroundColor: isDone ? "#10b981" : "#e5e7eb",
                            color: isDone ? "#fff" : "#6b7280",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            marginBottom: "6px",
                            boxShadow: isActive ? "0 0 0 4px rgba(16, 185, 129, 0.2)" : "none",
                          }}
                        >
                          {isDone ? <CheckCircle2 size={20} /> : idx + 1}
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: isActive ? 800 : isDone ? 600 : 400,
                            color: isActive ? "#0f172a" : "#64748b",
                          }}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "14px 16px",
                borderRadius: "12px",
                marginBottom: "16px",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#64748b" }}>Location / Folio:</span>
                <span style={{ fontWeight: 700 }}>{activeOrder.targetLabel}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#64748b" }}>Kitchen Ticket (KOT):</span>
                <span style={{ fontWeight: 700 }}>{activeOrder.kotNumber || "KOT-Pending"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Payment Mode:</span>
                <span style={{ fontWeight: 700 }}>
                  {activeOrder.settlementMethod === "POST_TO_ROOM"
                    ? "Posted to Room Stay Folio"
                    : activeOrder.orderType === "TAKEAWAY"
                      ? "Pay at the counter when you collect"
                      : activeOrder.settlementMethod}
                </span>
              </div>
            </div>

            {/* POS-017: what was ordered, with the API's own text for the choices and the API's prices (no maths here) */}
            {Array.isArray(activeOrder.lines) && activeOrder.lines.length > 0 && (
              <ul
                style={{ listStyle: "none", margin: "0 0 16px 0", padding: "0 4px", fontSize: "13px" }}
                data-testid="pos-qr-order-lines"
              >
                {activeOrder.lines.map((line, idx) => (
                  <li key={line.id ?? idx} style={{ padding: "6px 0", borderBottom: "1px solid #f1ebe4" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                      <span style={{ fontWeight: 700 }}>
                        {line.quantity} × {line.itemName}
                      </span>
                      {typeof line.totalPrice === "number" && Number.isFinite(line.totalPrice) && (
                        <span style={{ fontWeight: 700 }}>₹{formatRupees(line.totalPrice)}</span>
                      )}
                    </div>
                    {line.modifiersText && (
                      <div style={{ fontSize: "12px", color: "#786a63", marginTop: "2px" }}>{line.modifiersText}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {typeof activeOrder.totalAmount === "number" && Number.isFinite(activeOrder.totalAmount) && activeOrder.totalAmount > 0 && (
              <div
                style={{ display: "flex", justifyContent: "space-between", margin: "0 4px 16px 4px", fontSize: "14px", fontWeight: 800 }}
                data-testid="pos-qr-order-total"
              >
                <span>Order total</span>
                <span>₹{formatRupees(activeOrder.totalAmount)}</span>
              </div>
            )}

            {/* POS-067: Pay now for an unsettled order - Razorpay Checkout with the order the API created, settled only by verify-payment */}
            {(canPayNow(activeOrder) || paidNow) && (
              <QrPayNow
                tenantSlug={tenantSlug}
                tenantName={menu?.tenantName ?? "Atlas"}
                orderNumber={activeOrder.orderNumber}
                amountDue={activeOrder.amountDue ?? 0}
                onPaid={() => { setPaidNow(true); void reloadActiveOrder(); }}
              />
            )}

            {activeOrder.whatsAppUpdates && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  color: "#166534",
                  marginBottom: "16px",
                }}
              >
                <MessageSquare size={16} />
                <span>Live status updates are active on your WhatsApp.</span>
              </div>
            )}

            <button
              onClick={() => setActiveOrder(null)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#fff",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Order More Items
            </button>
          </section>
        ) : null}

        {/* Category Tabs */}
        <nav
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "8px",
            marginBottom: "16px",
            scrollbarWidth: "none",
          }}
          aria-label="Menu categories"
        >
          <button
            onClick={() => setSelectedCategory("ALL")}
            style={{
              padding: "8px 14px",
              borderRadius: "20px",
              border: "1px solid",
              borderColor: selectedCategory === "ALL" ? "#9e402a" : "#d8c7b8",
              backgroundColor: selectedCategory === "ALL" ? "#9e402a" : "#fff",
              color: selectedCategory === "ALL" ? "#fff" : "#4a3e39",
              fontSize: "13px",
              fontWeight: 700,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            All Items
          </button>
          {allCategories.map((c) => (
            <button
              key={c.categoryKey}
              onClick={() => setSelectedCategory(c.categoryKey)}
              style={{
                padding: "8px 14px",
                borderRadius: "20px",
                border: "1px solid",
                borderColor: selectedCategory === c.categoryKey ? "#9e402a" : "#d8c7b8",
                backgroundColor: selectedCategory === c.categoryKey ? "#9e402a" : "#fff",
                color: selectedCategory === c.categoryKey ? "#fff" : "#4a3e39",
                fontSize: "13px",
                fontWeight: 700,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {c.categoryKey === "FNB" && <Utensils size={14} style={{ display: "inline", marginRight: "4px" }} />}
              {c.categoryKey === "EXPERIENCE" && <Sparkles size={14} style={{ display: "inline", marginRight: "4px" }} />}
              {c.categoryKey === "TRANSPORT" && <Car size={14} style={{ display: "inline", marginRight: "4px" }} />}
              {c.categoryKey === "RETAIL" && <ShoppingBag size={14} style={{ display: "inline", marginRight: "4px" }} />}
              {c.title.split("(")[0].trim()}
            </button>
          ))}
        </nav>

        {/* POS-013: dietary filter chips, shown only when the host has classified at least one dish */}
        {showDietaryChips && (
          <div
            role="group"
            aria-label="Dietary filter"
            data-testid="qr-dietary-chips"
            style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "0 0 14px 0" }}
          >
            {DIETARY_FILTER_CHIPS.map((chip) => {
              const active = dietaryFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDietaryFilter(chip.key)}
                  data-testid={`qr-dietary-chip-${chip.key}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "16px",
                    border: "1px solid",
                    borderColor: active ? "#16a34a" : "#d8c7b8",
                    backgroundColor: active ? "#16a34a" : "#fff",
                    color: active ? "#fff" : "#4a3e39",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Items List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {dietaryFilter !== "ALL" &&
            visibleCategories.every((c) => c.items.every((i) => i.isSoldOut86 || !matchesDietaryFilter(i.dietary, dietaryFilter))) && (
              <p data-testid="qr-dietary-empty" style={{ margin: 0, fontSize: "13px", color: "#786a63" }}>
                No dishes are marked for this filter yet. Choose All to see the full menu.
              </p>
            )}
          {visibleCategories.map((cat) => {
            // Filter out items marked IsSoldOut86 (Done When #1)
            const availableItems = cat.items.filter((item) => !item.isSoldOut86 && matchesDietaryFilter(item.dietary, dietaryFilter));
            if (availableItems.length === 0) return null;

            return (
              <section key={cat.categoryKey}>
                <h2
                  style={{
                    fontSize: "16px",
                    fontWeight: 800,
                    margin: "0 0 12px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#1e1b18",
                  }}
                >
                  {cat.title}
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {availableItems.map((item) => {
                    const modifierGroups = parseModifierGroups(item.modifierGroups);
                    const hasModifiers = modifierGroups.length > 0;
                    const orderable = isOrderable(modifierGroups);
                    // An item with choices is added through its picker, so its row shows how many are already in the order.
                    const inCartQty = hasModifiers
                      ? cartLines.reduce((sum, l) => (l.item.id === item.id ? sum + l.qty : sum), 0)
                      : cart[String(item.id)]?.qty || 0;

                    return (
                      <div key={item.id}>
                      <div
                        style={{
                          backgroundColor: "#fff",
                          borderRadius: "14px",
                          padding: "14px 16px",
                          border: "1px solid #ebd9c8",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                        }}
                        data-testid={`menu-item-${item.id}`}
                      >
                        <div style={{ flex: 1, paddingRight: "16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                            {dietaryMarkColor(item.dietary) && (
                              <span
                                role="img"
                                aria-label={dietaryMarkLabel(item.dietary)}
                                title={dietaryMarkLabel(item.dietary)}
                                data-testid={`menu-item-dietary-${item.id}`}
                                data-dietary={item.dietary}
                                style={{
                                  display: "inline-block",
                                  width: "12px",
                                  height: "12px",
                                  border: `2px solid ${dietaryMarkColor(item.dietary)}`,
                                  padding: "1px",
                                  borderRadius: "2px",
                                  flex: "0 0 auto",
                                }}
                              >
                                <span
                                  style={{
                                    display: "block",
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    backgroundColor: dietaryMarkColor(item.dietary) ?? undefined,
                                  }}
                                />
                              </span>
                            )}
                            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e1b18" }}>
                              {item.name}
                            </h3>
                          </div>

                          {item.description && (
                            <p
                              style={{
                                margin: "0 0 6px 0",
                                fontSize: "12px",
                                color: "#786a63",
                                lineHeight: "1.4",
                              }}
                            >
                              {item.description}
                            </p>
                          )}

                          {item.allergens && (
                            <p
                              data-testid={`menu-item-allergens-${item.id}`}
                              style={{ margin: "0 0 6px 0", fontSize: "11px", fontWeight: 700, color: "#92400e" }}
                            >
                              Contains: {item.allergens}
                            </p>
                          )}

                          <span style={{ fontSize: "14px", fontWeight: 800, color: "#9e402a" }}>
                            ₹{item.price.toLocaleString("en-IN")}
                          </span>
                        </div>

                        {/* POS-014: dish photo, lazy-loaded at a fixed size so the list does not jump */}
                        {sanitizeGuestImageUrl(item.imageUrl) && (
                          <div style={{ width: "72px", height: "72px", marginRight: "12px", flex: "0 0 auto" }} data-testid={`menu-item-photo-${item.id}`}>
                            <OptimizedImage
                              src={item.imageUrl as string}
                              alt={item.name}
                              width={72}
                              height={72}
                              sizes="72px"
                              loading="lazy"
                              wrapperClassName="rounded-[10px]"
                              className="h-[72px] w-[72px] rounded-[10px] object-cover"
                            />
                          </div>
                        )}

                        {/* Add / Quantity selector */}
                        <div>
                          {inCartQty > 0 && !hasModifiers ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                backgroundColor: "#9e402a",
                                color: "#fff",
                                borderRadius: "8px",
                                padding: "4px 8px",
                              }}
                            >
                              <button
                                onClick={() => handleAdjustQty(String(item.id), -1)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#fff",
                                  cursor: "pointer",
                                  padding: "2px",
                                  display: "flex",
                                }}
                                data-testid={`cart-dec-${item.id}`}
                              >
                                <Minus size={16} />
                              </button>
                              <span style={{ fontWeight: 700, minWidth: "16px", textAlign: "center" }}>
                                {inCartQty}
                              </span>
                              <button
                                onClick={() => handleAdjustQty(String(item.id), 1)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#fff",
                                  cursor: "pointer",
                                  padding: "2px",
                                  display: "flex",
                                }}
                                data-testid={`cart-inc-${item.id}`}
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                              <button
                                onClick={() => handleAddToCart(item)}
                                disabled={hasModifiers && !orderable}
                                style={{
                                  backgroundColor: "#fff",
                                  border: "1.5px solid #9e402a",
                                  color: "#9e402a",
                                  padding: "6px 14px",
                                  borderRadius: "8px",
                                  fontWeight: 700,
                                  fontSize: "13px",
                                  cursor: hasModifiers && !orderable ? "not-allowed" : "pointer",
                                  opacity: hasModifiers && !orderable ? 0.5 : 1,
                                }}
                                data-testid={`add-to-cart-${item.id}`}
                              >
                                {hasModifiers && !orderable ? "Unavailable" : hasModifiers ? "CHOOSE +" : "ADD +"}
                              </button>
                              {hasModifiers && inCartQty > 0 && (
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#9e402a" }}>{inCartQty} in your order</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {hasModifiers && orderable && pickerItemId === item.id && (
                        <ModifierPicker
                          itemId={item.id}
                          itemName={item.name}
                          groups={modifierGroups}
                          onAdd={(selection) => handlePickerAdd(item, modifierGroups, selection)}
                          onCancel={() => setPickerItemId(null)}
                        />
                      )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Floating Cart / Checkout Drawer */}
        {cartCount > 0 && (
          <form
            ref={orderSheetRef}
            onSubmit={handlePlaceOrder}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#fff",
              borderTop: "2px solid #ebd9c8",
              padding: "16px 20px",
              boxShadow: "0 -6px 25px rgba(0,0,0,0.12)",
              zIndex: 99,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            data-testid="pos-qr-cart-drawer"
          >
            <div style={{ maxWidth: "680px", margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Receipt size={18} color="#9e402a" />
                  <span style={{ fontWeight: 800, fontSize: "16px" }}>Your Order ({cartCount} items)</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: "18px", color: "#9e402a" }} data-testid="pos-qr-total">
                  ₹{cartSubtotal.toLocaleString("en-IN")}
                </span>
              </div>

              {/* POS-017: each line with its chosen options and its price (menu price + deltas); the API prices the order itself */}
              <ul style={{ listStyle: "none", margin: "0 0 12px 0", padding: 0 }} data-testid="pos-qr-cart-lines">
                {cartLines.map((line) => (
                  <li
                    key={line.key}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "6px 0", borderBottom: "1px solid #f1ebe4" }}
                    data-testid="pos-qr-cart-line"
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e1b18" }}>{line.item.name}</div>
                      {line.modifiers.length > 0 && (
                        <div style={{ fontSize: "11px", color: "#786a63", marginTop: "1px" }}>{describeModifiers(line.modifiers)}</div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <button
                        type="button"
                        aria-label={`Remove one ${line.item.name}`}
                        onClick={() => handleAdjustQty(line.key, -1)}
                        style={{ background: "none", border: "1px solid #d8c7b8", borderRadius: "6px", cursor: "pointer", padding: "2px", display: "flex", color: "#4a3e39" }}
                        data-testid={`line-dec-${line.key}`}
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ fontWeight: 700, minWidth: "14px", textAlign: "center", fontSize: "13px" }}>{line.qty}</span>
                      <button
                        type="button"
                        aria-label={`Add one more ${line.item.name}`}
                        onClick={() => handleAdjustQty(line.key, 1)}
                        style={{ background: "none", border: "1px solid #d8c7b8", borderRadius: "6px", cursor: "pointer", padding: "2px", display: "flex", color: "#4a3e39" }}
                        data-testid={`line-inc-${line.key}`}
                      >
                        <Plus size={14} />
                      </button>
                      <span style={{ fontSize: "13px", fontWeight: 700, minWidth: "52px", textAlign: "right" }}>
                        ₹{formatRupees(Math.round(line.unitPrice * 100) * line.qty / 100)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* POS-011: room link / lock notice (the cart is open, so the page-top notice is hidden) */}
              {roomNotice}

              {/* POS-062: takeaway pickup (plain menu link only). No delivery, no address, no fee: the order is paid at the counter when collected. */}
              {takeawayOffered && (
                <div style={{ marginBottom: "14px" }} data-testid="pos-qr-fulfilment">
                  <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>
                    HOW WOULD YOU LIKE IT?
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {[
                      { value: false, label: "At the restaurant", testId: "fulfil-here" },
                      { value: true, label: "Takeaway pickup", testId: "fulfil-takeaway" },
                    ].map((option) => (
                      <button
                        key={option.testId}
                        type="button"
                        aria-pressed={takeaway === option.value}
                        onClick={() => setTakeaway(option.value)}
                        style={{
                          padding: "10px 8px",
                          borderRadius: "10px",
                          border: "1.5px solid",
                          borderColor: takeaway === option.value ? "#9e402a" : "#e2e8f0",
                          backgroundColor: takeaway === option.value ? "#fff5f2" : "#fff",
                          color: takeaway === option.value ? "#9e402a" : "#475569",
                          fontWeight: 700,
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                        data-testid={option.testId}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {takeawayActive && (
                <div
                  style={{ marginBottom: "14px", padding: "10px 12px", borderRadius: "10px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: "12px" }}
                  role="note"
                  data-testid="pos-qr-takeaway-note"
                >
                  You will pay at the counter when you collect your order. Please give your name and mobile number so we can call you when it is ready.
                  Delivery is not available from this menu.
                </div>
              )}

              {/* Settlement Options (Done When #2 & #3) */}
              {!takeawayActive && (
              <div style={{ marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>
                  HOW WOULD YOU LIKE TO PAY?
                </span>

                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, payMethodCount)}, 1fr)`, gap: "8px" }}>
                  {roomChargeAvailable && (
                    <button
                      type="button"
                      onClick={() => setSettlementMethod("POST_TO_ROOM")}
                      disabled={showVerificationWarning}
                      style={{
                        padding: "10px 8px",
                        borderRadius: "10px",
                        border: "1.5px solid",
                        borderColor: settlementMethod === "POST_TO_ROOM" ? "#9e402a" : "#e2e8f0",
                        backgroundColor: settlementMethod === "POST_TO_ROOM" ? "#fff5f2" : "#fff",
                        color: settlementMethod === "POST_TO_ROOM" ? "#9e402a" : "#475569",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: showVerificationWarning ? "not-allowed" : "pointer",
                        opacity: showVerificationWarning ? 0.5 : 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      data-testid="settle-post-to-room"
                    >
                      <ShieldCheck size={18} />
                      Post to Room
                    </button>
                  )}

                  {offerPayNow && (
                  <button
                    type="button"
                    onClick={() => setSettlementMethod("PAY_NOW_UPI")}
                    style={{
                      padding: "10px 8px",
                      borderRadius: "10px",
                      border: "1.5px solid",
                      borderColor: settlementMethod === "PAY_NOW_UPI" ? "#9e402a" : "#e2e8f0",
                      backgroundColor: settlementMethod === "PAY_NOW_UPI" ? "#fff5f2" : "#fff",
                      color: settlementMethod === "PAY_NOW_UPI" ? "#9e402a" : "#475569",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    data-testid="settle-pay-now-upi"
                  >
                    <Smartphone size={18} />
                    Pay Now (UPI)
                  </button>
                  )}

                  {offerPayOnDelivery && (
                  <button
                    type="button"
                    onClick={() => setSettlementMethod("PAY_ON_DELIVERY")}
                    style={{
                      padding: "10px 8px",
                      borderRadius: "10px",
                      border: "1.5px solid",
                      borderColor: settlementMethod === "PAY_ON_DELIVERY" ? "#9e402a" : "#e2e8f0",
                      backgroundColor: settlementMethod === "PAY_ON_DELIVERY" ? "#fff5f2" : "#fff",
                      color: settlementMethod === "PAY_ON_DELIVERY" ? "#9e402a" : "#475569",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    data-testid="settle-pay-on-delivery"
                  >
                    <Utensils size={18} />
                    Pay on Delivery
                  </button>
                  )}
                </div>
              </div>
              )}

              {/* Room Charge Anti-Abuse Guardrail Field (Done When #2) */}
              {settlementMethod === "POST_TO_ROOM" && roomChargeAvailable && (
                <div
                  style={{
                    backgroundColor: "#fdf8f6",
                    border: "1px solid #ebd9c8",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    marginBottom: "12px",
                  }}
                  data-testid="pos-qr-room-guardrail-section"
                >
                  <label
                    style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e1b18", marginBottom: "4px" }}
                  >
                    Security Verification for {targetHeading}:
                  </label>
                  <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "#786a63" }}>
                    Enter the last 4 digits of your booking&apos;s registered phone number OR 4-digit Stay PIN to post charges to your room folio.
                  </p>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="e.g. 4829 or Stay PIN"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      fontWeight: 600,
                      boxSizing: "border-box",
                    }}
                    data-testid="pos-qr-verification-input"
                  />
                  {isKnownInvalidCode && (
                    <div
                      style={{
                        backgroundColor: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "8px",
                      }}
                      data-testid="pos-qr-room-invalid-alert"
                    >
                      <AlertCircle size={14} />
                      <span>
                        Phone last-4 or Stay PIN does not match active CheckedIn booking for this room. Please Pay Now via UPI or pay online upfront.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Walk-in / Contact Details */}
              {settlementMethod !== "POST_TO_ROOM" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                  <input
                    type="text"
                    placeholder={takeawayActive ? "Your Name" : "Your Name (Optional)"}
                    aria-required={takeawayActive}
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                    data-testid="pos-qr-guest-name"
                  />
                  <input
                    type="tel"
                    placeholder={takeawayActive ? "Mobile Number" : "Mobile Number (Optional)"}
                    aria-required={takeawayActive}
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                    data-testid="pos-qr-guest-phone"
                  />
                </div>
              )}

              {/* POS-047 L3: optional promo code (not offered on a room charge, which the server refuses a code on) */}
              {settlementMethod !== "POST_TO_ROOM" && (
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "4px" }} htmlFor="pos-qr-promo-code">
                    Promo code (optional)
                  </label>
                  <input
                    id="pos-qr-promo-code"
                    type="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    maxLength={32}
                    placeholder="Have a code from the restaurant?"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      textTransform: "uppercase",
                    }}
                    data-testid="pos-qr-promo-code"
                  />
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    The discount comes off the food total before GST. You will see the final total once the order is placed.
                  </div>
                </div>
              )}

              {/* Special Instructions & WhatsApp Option */}
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "4px" }} htmlFor="pos-qr-fulfill-at">
                  Fulfill at
                </label>
                <select
                  id="pos-qr-fulfill-at"
                  value={fulfillAt}
                  onChange={(e) => setFulfillAt(e.target.value as FulfillAtMode)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    marginBottom: "8px",
                    boxSizing: "border-box",
                    backgroundColor: "#fff",
                  }}
                  data-testid="pos-qr-fulfill-at"
                >
                  <option value="NOW">As soon as possible (Now)</option>
                  {FULFILL_SLOTS.map((s) => (
                    <option key={s.mode} value={s.mode}>
                      Schedule for Later: {s.label}
                    </option>
                  ))}
                  <option value="CUSTOM">Schedule for Later: Custom time</option>
                </select>
                {fulfillAt === "CUSTOM" && (
                  <input
                    type="time"
                    value={customFulfillTime}
                    onChange={(e) => setCustomFulfillTime(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      marginBottom: "8px",
                      boxSizing: "border-box",
                    }}
                    data-testid="pos-qr-fulfill-custom-time"
                    aria-label="Serve at"
                  />
                )}
                <input
                  type="text"
                  placeholder="Kitchen instructions (e.g. less spicy, extra cutlery)"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    marginBottom: "8px",
                    boxSizing: "border-box",
                  }}
                  data-testid="pos-qr-notes-input"
                />

                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#475569" }}>
                  <input
                    type="checkbox"
                    checked={whatsAppUpdates}
                    onChange={(e) => setWhatsAppUpdates(e.target.checked)}
                  />
                  Receive live preparation and dispatch updates on WhatsApp
                </label>
              </div>

              {/* Verification / Server Error Banner */}
              {verificationError && (
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                  data-testid="pos-qr-room-verification-error"
                >
                  <AlertCircle size={16} />
                  <span>{verificationError}</span>
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <span style={{ fontWeight: 700 }} data-testid="pos-qr-attempts-remaining">
                      You have {attemptsRemaining} {attemptsRemaining === 1 ? "try" : "tries"} left before charging to the room is paused.
                    </span>
                  )}
                </div>
              )}

              {/* Place Order CTA */}
              <button
                type="submit"
                disabled={submitting || (settlementMethod === "POST_TO_ROOM" && (showVerificationWarning || !verificationCode.trim()))}
                style={{
                  width: "100%",
                  backgroundColor: "#9e402a",
                  color: "#fff",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "15px",
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
                data-testid="pos-qr-submit-btn"
              >
                {submitting ? "Placing Order..." : takeawayActive ? `Place Takeaway Order • ₹${cartSubtotal.toLocaleString("en-IN")}` : settlementMethod === "POST_TO_ROOM" ? `Charge to Room • ₹${cartSubtotal.toLocaleString("en-IN")}` : `Place Order • ₹${cartSubtotal.toLocaleString("en-IN")}`}
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
