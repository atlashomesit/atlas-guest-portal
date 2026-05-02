import { useMemo, useState } from "react";
import SEO from "../components/SEO";
import { LOGO_URL } from "../config/branding";
import { useTenantListings } from "../hooks/useTenantListings";
import { filterGuestImageUrls, sanitizeGuestImageUrl } from "../utils/guestImageUrl";
import { getTenantContext } from "../tenant/tenantContext";
import { getTenantOverrides } from "../tenant/tenantOverrides";

interface GalleryItem {
  propertyId: number;
  propertyName: string;
  location: string;
  segment: string;
  url: string;
  order: number;
}

const getSegment = (id: number) => {
  if (id >= 500) return "Signature Suites";
  if (id >= 300) return "Spacious Flats";
  if (id >= 200) return "Premium Floors";
  return "Studios";
};

const GalleryPage = () => {
  const { properties } = useTenantListings();
  const tenant = getTenantContext();
  const tenantOverrides = getTenantOverrides(tenant?.slug);
  const [activeSegment, setActiveSegment] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const galleryItems = useMemo(() => {
    return properties.flatMap((property): GalleryItem[] => {
      const rawId = property.id;
      const id = typeof rawId === "string" ? Number(rawId) : rawId;
      if (!Number.isFinite(id)) return [];

      const images = filterGuestImageUrls(property.property_img ?? []);
      const sourceImages =
        images.length > 0
          ? images
          : tenantOverrides.hideLogo
            ? [""]
            : [sanitizeGuestImageUrl(LOGO_URL) ?? ""];

      const name = property.property_name ?? `Listing ${property.listingId ?? id}`;
      const location = property.property_location ?? "";

      return sourceImages.map((url, index) => ({
        propertyId: id,
        propertyName: name,
        location,
        segment: getSegment(id),
        url,
        order: index,
      }));
    });
  }, [properties, tenantOverrides.hideLogo]);

  const segments = useMemo(() => {
    const segmentCounts = galleryItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.segment] = (acc[item.segment] ?? 0) + 1;
      return acc;
    }, {});

    return [
      { id: "all", label: "All homes", count: galleryItems.length },
      ...Object.entries(segmentCounts).map(([id, count]) => ({ id, label: id, count })),
    ];
  }, [galleryItems]);

  const filteredItems = useMemo(() => {
    return galleryItems.filter((item) => {
      const matchesSegment = activeSegment === "all" || item.segment === activeSegment;
      const matchesProperty = propertyFilter === "all" || String(item.propertyId) === propertyFilter;
      const query = searchTerm.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        item.propertyName.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query);

      return matchesSegment && matchesProperty && matchesQuery;
    });
  }, [activeSegment, galleryItems, propertyFilter, searchTerm]);

  return (
    <div className="px-4 md:px-10 lg:px-20 py-24 bg-bg-muted min-h-screen">
      <SEO
        title={
          tenantOverrides.hideAtlasHomesBranding && tenant?.name?.trim()
            ? `Gallery | ${tenant.name.trim()}`
            : "Gallery | Atlas Homestays"
        }
        description={
          tenantOverrides.hideAtlasHomesBranding && tenant?.name?.trim()
            ? `Browse property photos for ${tenant.name.trim()}.`
            : "Browse Atlas Homestays property photos, grouped by floor and suite type."
        }
      />

      <div className="max-w-6xl mx-auto space-y-10">
        <div className="space-y-3 text-center md:text-left">
          {tenantOverrides.hideAtlasHomesBranding ? (
            tenant?.name?.trim() ? (
              <p className="uppercase tracking-[0.2em] text-primary font-semibold">{tenant.name.trim()}</p>
            ) : null
          ) : (
            <p className="uppercase tracking-[0.2em] text-primary font-semibold">Atlas Homestays</p>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary">Gallery</h1>
          <p className="text-lg text-text-muted">
            Explore our homes through curated photography. Filter by suite type or select a specific room to see
            everything available.
          </p>
        </div>

        <div className="bg-bg-surface border border-border-subtle shadow-level1 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              {segments.map((segment) => (
                <button
                  key={segment.id}
                  onClick={() => setActiveSegment(segment.id)}
                  className={`rounded-full border px-4 py-4 text-base font-semibold transition shadow-sm ${
                    activeSegment === segment.id
                      ? "bg-primary text-[var(--text-contrast)] border-primary"
                      : "bg-bg-muted text-text-primary border-border-subtle hover:border-primary"
                  }`}
                  aria-pressed={activeSegment === segment.id}
                >
                  {segment.label} <span className="text-text-muted font-normal">({segment.count})</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              <label className="w-full md:w-56">
                <span className="text-sm text-text-muted">Filter by property</span>
                <select
                  className="mt-1 min-h-[44px] w-full rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-base text-text-primary focus:border-primary focus:outline-none"
                  value={propertyFilter}
                  onChange={(event) => setPropertyFilter(event.target.value)}
                >
                  <option value="all">All properties</option>
                  {properties
                    .map((property) => {
                      const rawId = property.id;
                      const id = typeof rawId === "string" ? Number(rawId) : rawId;
                      return Number.isFinite(id) ? { property, id: id as number } : null;
                    })
                    .filter((row): row is { property: (typeof properties)[number]; id: number } => row !== null)
                    .map(({ property, id }) => (
                      <option key={`${property.listingId ?? "x"}-${id}`} value={String(id)}>
                        {property.property_name ?? `Room ${id}`}
                      </option>
                    ))}
                </select>
              </label>

              <label className="w-full md:w-64">
                <span className="text-sm text-text-muted">Search</span>
                <input
                  type="search"
                  placeholder="Search by location or name"
                  className="mt-1 min-h-[44px] w-full rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-base text-text-primary focus:border-primary focus:outline-none"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-16 text-text-muted">No images match your filters yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map((item) => (
                <figure
                  key={`${item.propertyId}-${item.order}`}
                  className="group relative overflow-hidden rounded-xl border border-border-subtle bg-bg-muted shadow-sm"
                >
                  {item.url ? (
                    <img
                      src={item.url}
                      alt={`${item.propertyName} photo ${item.order + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-60 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div
                      className="h-60 w-full bg-bg-muted bg-[linear-gradient(135deg,color-mix(in_srgb,var(--border-subtle)_55%,transparent)_0%,color-mix(in_srgb,var(--bg-muted)_92%,transparent)_100%)]"
                      role="img"
                      aria-label={`${item.propertyName} — no photo`}
                    />
                  )}
                  <figcaption className="absolute inset-x-0 bottom-0 bg-[color:color-mix(in_srgb,var(--text-primary)_80%,transparent)] text-[var(--text-contrast)] p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold leading-tight">{item.propertyName}</p>
                        <p className="text-xs text-[color-mix(in_srgb,var(--text-contrast)_75%,transparent)]">
                          {item.location} • {item.segment}
                        </p>
                      </div>
                      <span className="text-[0.7rem] font-semibold bg-[color:color-mix(in_srgb,var(--text-contrast)_25%,transparent)] text-[var(--text-contrast)] px-2 py-1 rounded-full">
                        #{item.order + 1}
                      </span>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GalleryPage;
