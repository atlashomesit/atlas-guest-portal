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

const metaString = (
  bag: Record<string, unknown> | undefined,
  key: string,
): string | undefined => {
  const value = bag?.[key];
  return typeof value === "string" ? value : undefined;
};

const pickPropertySlugSource = (property: PropertyLike): string =>
  property.property_slug ??
  property.slug ??
  metaString(property.property_metadata, "property_slug") ??
  metaString(property.metadata, "property_slug") ??
  metaString(property.property_metadata, "slug") ??
  metaString(property.metadata, "slug") ??
  property.property_name ??
  metaString(property.property_metadata, "property_name") ??
  metaString(property.metadata, "property_name") ??
  property.name ??
  metaString(property.property_metadata, "name") ??
  metaString(property.metadata, "name") ??
  property.title ??
  "";

const pickUnitSlugSource = (property: PropertyLike): string => {
  const raw =
    property.unit_slug ??
    property.unitSlug ??
    (property.id != null ? String(property.id) : undefined) ??
    property.slug ??
    property.property_name ??
    property.name ??
    property.title ??
    metaString(property.property_metadata, "unit_slug") ??
    metaString(property.metadata, "unit_slug") ??
    metaString(property.property_metadata, "slug") ??
    metaString(property.metadata, "slug") ??
    "unit";
  return String(raw);
};

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
