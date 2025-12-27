import type { NavigateFunction, NavigateOptions } from "react-router-dom";

export const buildHomeUnitPath = (propertySlug: string, unitSlug: string): string =>
  `/property_details/${propertySlug}-${unitSlug}`;

export const navigateToHomeUnit = (
  navigate: NavigateFunction,
  propertySlug: string,
  unitSlug: string,
  options?: NavigateOptions,
): string => {
  const path = buildHomeUnitPath(propertySlug, unitSlug);
  navigate(path, options);
  return path;
};
