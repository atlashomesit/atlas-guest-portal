import React, { useMemo } from "react";

export interface BedroomBedItem {
  bedType: string;
  count: number;
}

export interface BedroomConfigEntry {
  bedroomNumber?: number;
  label?: string | null;
  beds?: BedroomBedItem[] | null;
  photoUrl?: string | null;
}

export interface SleepingArrangementsSectionProps {
  bedroomsConfig?: BedroomConfigEntry[] | string | null;
  className?: string;
}

const BED_LABELS: Record<string, { singular: string; plural: string; icon: string }> = {
  king: { singular: "king bed", plural: "king beds", icon: "🛏️" },
  queen: { singular: "queen bed", plural: "queen beds", icon: "🛏️" },
  double: { singular: "double bed", plural: "double beds", icon: "🛏️" },
  single: { singular: "single bed", plural: "single beds", icon: "🛌" },
  twin: { singular: "twin bed", plural: "twin beds", icon: "🛌" },
  bunk: { singular: "bunk bed", plural: "bunk beds", icon: "🪜" },
  sofa: { singular: "sofa bed", plural: "sofa beds", icon: "🛋️" },
  sofa_bed: { singular: "sofa bed", plural: "sofa beds", icon: "🛋️" },
  crib: { singular: "crib", plural: "cribs", icon: "🍼" },
  floor_mattress: { singular: "floor mattress", plural: "floor mattresses", icon: "🛏️" },
};

export function parseBedroomsConfig(
  raw: BedroomConfigEntry[] | string | null | undefined,
): BedroomConfigEntry[] {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      arr = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (entry): entry is BedroomConfigEntry =>
      Boolean(entry && typeof entry === "object" && Array.isArray((entry as BedroomConfigEntry).beds) && (entry as BedroomConfigEntry).beds!.length > 0),
  );
}

export function formatBedSummary(beds: BedroomBedItem[]): string {
  return beds
    .filter((b) => b && b.count > 0 && b.bedType)
    .map((b) => {
      const key = b.bedType.toLowerCase().trim().replace(/\s+/g, "_");
      const meta = BED_LABELS[key];
      if (meta) {
        return `${b.count} ${b.count === 1 ? meta.singular : meta.plural}`;
      }
      const clean = b.bedType.replace(/_/g, " ").trim();
      return `${b.count} ${clean}${b.count === 1 ? "" : "s"}`;
    })
    .join(", ");
}

function bedIconFor(bedType: string): string {
  const key = bedType.toLowerCase().trim().replace(/\s+/g, "_");
  return BED_LABELS[key]?.icon ?? "🛏️";
}

export const SleepingArrangementsSection: React.FC<SleepingArrangementsSectionProps> = ({
  bedroomsConfig,
  className = "",
}) => {
  const rooms = useMemo(() => parseBedroomsConfig(bedroomsConfig), [bedroomsConfig]);

  if (rooms.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="sleeping-arrangements-section"
      aria-labelledby="where-youll-sleep-heading"
      className={`my-6 ${className}`.trim()}
    >
      <h2
        id="where-youll-sleep-heading"
        className="text-lg font-semibold text-text-primary mb-3"
      >
        Where you&apos;ll sleep
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rooms.map((room, idx) => {
          const roomLabel =
            room.label?.trim() ||
            (room.bedroomNumber ? `Bedroom ${room.bedroomNumber}` : `Room ${idx + 1}`);
          const beds = (room.beds ?? []).filter((b) => b.count > 0);
          const summary = formatBedSummary(beds);
          return (
            <div
              key={`${roomLabel}-${idx}`}
              data-testid={`sleeping-room-card-${idx}`}
              className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-xs flex flex-col"
            >
              {room.photoUrl && (
                <img
                  src={room.photoUrl}
                  alt={roomLabel}
                  loading="lazy"
                  className="h-32 w-full object-cover"
                />
              )}
              <div className="p-4 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-lg" aria-hidden="true">
                  {beds.slice(0, 4).map((b, bIdx) => (
                    <span key={bIdx}>{bedIconFor(b.bedType)}</span>
                  ))}
                </div>
                <div className="text-sm font-semibold text-text-primary">{roomLabel}</div>
                <div className="text-xs text-text-secondary">{summary}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default SleepingArrangementsSection;
