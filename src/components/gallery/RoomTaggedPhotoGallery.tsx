import React, { useMemo, useState } from "react";

export interface RoomTaggedPhoto {
  id: string;
  url: string;
  caption?: string;
  roomLabel: string;
  bedSetupLabel?: string;
}

export interface RoomTaggedPhotoGalleryProps {
  photos: RoomTaggedPhoto[];
}

export default function RoomTaggedPhotoGallery({ photos }: RoomTaggedPhotoGalleryProps) {
  const rooms = useMemo(() => {
    const set = new Set<string>();
    for (const p of photos) {
      if (p.roomLabel.trim()) set.add(p.roomLabel.trim());
    }
    return ["All rooms", ...Array.from(set)];
  }, [photos]);

  const [selectedRoom, setSelectedRoom] = useState("All rooms");

  const visiblePhotos = useMemo(() => {
    if (selectedRoom === "All rooms") return photos;
    return photos.filter((p) => p.roomLabel.trim() === selectedRoom);
  }, [photos, selectedRoom]);

  if (photos.length === 0) return null;

  return (
    <section data-testid="clu041-room-tagged-gallery" aria-label="Room-by-room villa photo gallery">
      <div role="tablist" aria-label="Filter photos by room" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {rooms.map((room) => {
          const active = selectedRoom === room;
          return (
            <button
              key={room}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedRoom(room)}
              style={{
                minHeight: 38,
                padding: "6px 14px",
                borderRadius: 999,
                border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
                background: active ? "#0f172a" : "#fff",
                color: active ? "#fff" : "#334155",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {room}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {visiblePhotos.map((photo) => (
          <figure
            key={photo.id}
            style={{
              margin: 0,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <img
              src={photo.url}
              alt={photo.caption || `${photo.roomLabel}${photo.bedSetupLabel ? ` — ${photo.bedSetupLabel}` : ""}`}
              loading="lazy"
              style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
            />
            <figcaption style={{ padding: "10px 12px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{photo.roomLabel}</div>
              {photo.bedSetupLabel && (
                <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 600, marginTop: 2 }}>
                  {photo.bedSetupLabel}
                </div>
              )}
              {photo.caption && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{photo.caption}</div>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
