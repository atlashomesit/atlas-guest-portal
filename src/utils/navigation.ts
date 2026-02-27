import type { NavigateFunction, NavigateOptions } from "react-router-dom";

const slugify = (value: string): string =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

type PropertyLike = {
  id?: string | number;
  title?: string;
  name?: string;
  slug?: string;
  unit_slug?: string;
  unitSlug?: string;
  property_slug?: string;
  property_name?: string;
  metadata?: Record<string, unknown>;
  property_metadata?: Record<string, unknown>;
};

const pickPropertySlugSource = (property: PropertyLike): string =>
  (property.property_slug as string | undefined) ??
  (property.slug as string | undefined) ??
  (property.property_metadata as Record<string, unknown> | undefined)?.property_slug as string | undefined ??
  (property.metadata as Record<string, unknown> | undefined)?.property_slug as string | undefined ??
  (property.property_metadata as Record<string, unknown> | undefined)?.slug as string | undefined ??
  (property.metadata as Record<string, unknown> | undefined)?.slug as string | undefined ??
  property.property_name ??
  (property.property_metadata as Record<string, unknown> | undefined)?.property_name as string | undefined ??
  (property.metadata as Record<string, unknown> | undefined)?.property_name as string | undefined ??
  property.name ??
  (property.property_metadata as Record<string, unknown> | undefined)?.name as string | undefined ??
  (property.metadata as Record<string, unknown> | undefined)?.name as string | undefined ??
  property.title ??
  "";

const pickUnitSlugSource = (property: PropertyLike): string | number =>
  property.unit_slug ??
  property.unitSlug ??
  property.id ??
  property.slug ??
  property.property_name ??
  property.name ??
  property.title ??
  (property.property_metadata as Record<string, unknown> | undefined)?.unit_slug ??
  (property.metadata as Record<string, unknown> | undefined)?.unit_slug ??
  (property.property_metadata as Record<string, unknown> | undefined)?.slug ??
  (property.metadata as Record<string, unknown> | undefined)?.slug ??
  "unit";

export const getPropertySlug = (property: PropertyLike): string => {
  const source = pickPropertySlugSource(property) || "atlas homes";
  const slug = slugify(source);
  return slug || "atlas-homes";
};

export const getUnitSlug = (property: PropertyLike): string => {
  const source = pickUnitSlugSource(property);
  const slug = slugify(source);
  return slug || "unit";
};

/**
 * Returns the listingId (PK) segment for the details route.
 * MUST be Listing.Id from DB/API - never derived from name/room code.
 */
export const getListingIdSegment = (listingId: number): string => String(listingId);

export const buildHomeUnitPath = (propertySlug: string, listingId: number): string =>
  `/homes/${propertySlug}/${getListingIdSegment(listingId)}`;

export const navigateToHomeUnit = (
  navigate: NavigateFunction,
  propertySlug: string,
  listingId: number,
  options?: NavigateOptions,
): string => {
  const path = buildHomeUnitPath(propertySlug, listingId);
  navigate(path, options);
  return path;
};
