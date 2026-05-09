import { useEffect, useRef, useState } from 'react';
import { buildApiUrl, getApiHeaders } from '../api/client';

/** Task 37: 3D virtual tour viewer for the listing detail page.
 *  Pannellum is bundled and dynamically imported only when a pannellum tour is present,
 *  so pages without 3D tours don't pay the JS/CSS cost and CSP stays on self-hosted assets. */

interface Tour3D {
  id: number;
  tourType: string;
  tourUrl: string;
  title: string | null;
  hotspotsJson: string | null;
  sortOrder: number;
}

export default function VirtualTourSection({ listingId }: { listingId: number }) {
  const [tours, setTours] = useState<Tour3D[] | null>(null);

  useEffect(() => {
    if (!Number.isFinite(listingId) || listingId <= 0) return;
    let active = true;
    const ctrl = new AbortController();
    fetch(buildApiUrl(`/api/public/listings/${listingId}/media-3d`), {
      headers: getApiHeaders(),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!active) return;
        setTours(Array.isArray(data) ? (data as Tour3D[]) : []);
      })
      .catch(() => { if (active) setTours([]); });
    return () => { active = false; ctrl.abort(); };
  }, [listingId]);

  if (!tours || tours.length === 0) return null;

  return (
    <section className="my-6" data-testid="virtual-tour-section" aria-labelledby="virtual-tour-heading">
      <h2 id="virtual-tour-heading" className="text-xl font-semibold mb-3 text-text-primary">
        Virtual Tour
      </h2>
      <div className="flex flex-col gap-6">
        {tours.map((t) => {
          if (t.tourType === 'matterport') return <MatterportEmbed key={t.id} tour={t} />;
          if (t.tourType === 'pannellum') return <PannellumViewer key={t.id} tour={t} />;
          return null;
        })}
      </div>
    </section>
  );
}

function MatterportEmbed({ tour }: { tour: Tour3D }) {
  return (
    <div className="rounded-xl overflow-hidden">
      {tour.title && <h3 className="text-base font-medium mb-2 text-text-primary">{tour.title}</h3>}
      <iframe
        data-testid="matterport-embed"
        src={tour.tourUrl}
        title={tour.title ?? 'Matterport tour'}
        allow="fullscreen; xr-spatial-tracking"
        allowFullScreen
        className="w-full aspect-video border-0 rounded-xl bg-bg-muted"
      />
    </div>
  );
}

interface Hotspot {
  pitch: number;
  yaw: number;
  type: 'info' | 'custom';
  text: string;
  url?: string;
}

interface PannellumViewerHandle {
  destroy?: () => void;
}

type PannellumApi = {
  viewer: (
    target: HTMLElement,
    config: {
      type: string;
      panorama: string;
      autoLoad: boolean;
      hotSpots?: Hotspot[];
    },
  ) => PannellumViewerHandle;
};

interface PannellumWindow {
  pannellum?: PannellumApi;
}

function PannellumViewer({ tour }: { tour: Tour3D }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let viewer: PannellumViewerHandle | null = null;
    void (async () => {
      try {
        const [pannellumMod] = await Promise.all([
          import('pannellum'),
          import('pannellum/build/pannellum.css'),
        ]);
        if (cancelled || !containerRef.current) return;
        const pannellum =
          (pannellumMod as { default?: PannellumApi }).default ??
          (window as unknown as PannellumWindow).pannellum;
        if (!pannellum) return;
        const hotspots: Hotspot[] = (() => {
          if (!tour.hotspotsJson) return [];
          try {
            const parsed = JSON.parse(tour.hotspotsJson);
            return Array.isArray(parsed) ? (parsed as Hotspot[]) : [];
          } catch {
            return [];
          }
        })();
        viewer = pannellum.viewer(containerRef.current, {
          type: 'equirectangular',
          panorama: tour.tourUrl,
          autoLoad: true,
          hotSpots: hotspots,
        });
      } catch {
        /* bundle unreachable: leave placeholder */
      }
    })();
    return () => {
      cancelled = true;
      try { viewer?.destroy?.(); } catch { /* noop */ }
    };
  }, [tour.id, tour.tourUrl, tour.hotspotsJson]);

  return (
    <div>
      {tour.title && <h3 className="text-base font-medium mb-2 text-text-primary">{tour.title}</h3>}
      <div
        ref={containerRef}
        data-testid="pannellum-viewer"
        className="w-full aspect-video rounded-xl bg-bg-muted overflow-hidden"
      />
    </div>
  );
}
