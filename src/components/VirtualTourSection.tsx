import { useEffect, useRef, useState } from 'react';
import { buildApiUrl, getApiHeaders } from '../api/client';

/** Task 37: 3D virtual tour viewer for the listing detail page.
 *  Pannellum CDN script is injected only when a pannellum tour is present, so
 *  pages without 3D tours don't pay the JS download cost. */

interface Tour3D {
  id: number;
  tourType: string;
  tourUrl: string;
  title: string | null;
  hotspotsJson: string | null;
  sortOrder: number;
}

const PANNELLUM_VERSION = '2.5.6';
const PANNELLUM_JS = `https://cdn.jsdelivr.net/npm/pannellum@${PANNELLUM_VERSION}/build/pannellum.js`;
const PANNELLUM_CSS = `https://cdn.jsdelivr.net/npm/pannellum@${PANNELLUM_VERSION}/build/pannellum.css`;

let pannellumLoadPromise: Promise<void> | null = null;
function loadPannellum(): Promise<void> {
  if (pannellumLoadPromise) return pannellumLoadPromise;
  if (typeof window !== 'undefined' && (window as unknown as { pannellum?: unknown }).pannellum) {
    pannellumLoadPromise = Promise.resolve();
    return pannellumLoadPromise;
  }
  pannellumLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-pannellum-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = PANNELLUM_CSS;
      link.dataset.pannellumCss = 'true';
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-pannellum-js]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('pannellum load failed')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = PANNELLUM_JS;
    script.async = true;
    script.dataset.pannellumJs = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('pannellum load failed'));
    document.head.appendChild(script);
  });
  return pannellumLoadPromise;
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

interface PannellumWindow {
  pannellum?: {
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
}

function PannellumViewer({ tour }: { tour: Tour3D }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let viewer: PannellumViewerHandle | null = null;
    loadPannellum()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const w = window as unknown as PannellumWindow;
        if (!w.pannellum) return;
        const hotspots: Hotspot[] = (() => {
          if (!tour.hotspotsJson) return [];
          try {
            const parsed = JSON.parse(tour.hotspotsJson);
            return Array.isArray(parsed) ? (parsed as Hotspot[]) : [];
          } catch {
            return [];
          }
        })();
        viewer = w.pannellum.viewer(containerRef.current, {
          type: 'equirectangular',
          panorama: tour.tourUrl,
          autoLoad: true,
          hotSpots: hotspots,
        });
      })
      .catch(() => { /* CDN unreachable: leave placeholder */ });
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
