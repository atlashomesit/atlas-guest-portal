#!/usr/bin/env node
/**
 * CI guardrail: fails if listing routing/API code introduces patterns that derive
 * IDs from listing name (e.g. Atlas102 → 102) instead of using Listing.Id (PK).
 *
 * Scans: navigation, homes, Homepage_PropertyDetails, HomePage_Locations,
 * SearchPage, Apartments, listingResolver, listingClient
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TARGETS = [
  "src/utils/navigation.ts",
  "src/content/homes.ts",
  "src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx",
  "src/components/homepage_components/homepage_locations/HomePage_Locations.tsx",
  "src/pages/SearchPage.tsx",
  "src/pages/Apartments.tsx",
  "src/utils/listingResolver.ts",
  "src/api/listingClient.ts",
];

const BAD_PATTERNS = [
  {
    regex: /\.replace\s*\(\s*\/\\D\/g/,
    msg: "replace(/\\D/g) extracts digits - do not use for listing IDs",
  },
  {
    regex: /parseInt\s*\(\s*[^)]*\.(name|title|property_name)/,
    msg: "parseInt on name/title/property_name derives ID - use Listing.Id",
  },
  {
    regex: /Number\s*\(\s*[^)]*\.(name|title|property_name)\s*\.replace/,
    msg: "Number(name.replace...) derives ID - use Listing.Id",
  },
  {
    regex: /\/listings\/\s*[`'"]?\s*\+\s*[^+]+\.(name|property_name|roomNo)/,
    msg: "Building /listings/ from name/property_name/roomNo - use Listing.Id",
  },
];

let failed = false;
for (const rel of TARGETS) {
  const path = join(ROOT, rel);
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  for (const { regex, msg } of BAD_PATTERNS) {
    if (regex.test(content)) {
      console.error(`[FAIL] ${rel}: ${msg}`);
      failed = true;
    }
  }
}
if (failed) {
  console.error("\nListing details route and API MUST use Listing.Id (PK). Do not derive IDs from listing name.");
  process.exit(1);
}
console.log("check-listing-id-guardrail: OK");
