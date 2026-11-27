/**
 * POS-152: Automatic day-and-time happy hour and weekday promo pricing windows for QR menu.
 */

export interface HappyHourWindow {
  id: string;
  label: string;
  daysOfWeek: number[]; // 0=Sun .. 6=Sat
  startMinuteOfDay: number; // e.g. 16*60 = 960
  endMinuteOfDay: number; // e.g. 19*60 = 1140
  discountPct: number;
}

export function resolveActiveHappyHourPrice(
  basePriceInr: number,
  windows: HappyHourWindow[],
  now: Date
): { finalPriceInr: number; activeWindow: HappyHourWindow | null } {
  const day = now.getDay();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();

  let best: HappyHourWindow | null = null;
  for (const w of windows) {
    if (!w.daysOfWeek.includes(day)) continue;
    if (minuteOfDay >= w.startMinuteOfDay && minuteOfDay < w.endMinuteOfDay) {
      if (!best || w.discountPct > best.discountPct) {
        best = w;
      }
    }
  }

  if (!best) return { finalPriceInr: basePriceInr, activeWindow: null };
  const finalPriceInr = Math.max(0, Math.round(basePriceInr * (1 - best.discountPct / 100)));
  return { finalPriceInr, activeWindow: best };
}
