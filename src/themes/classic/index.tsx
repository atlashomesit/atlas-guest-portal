/**
 * TASK-4903 / ADR-0081 — "classic" layout theme.
 *
 * `classic` IS the Sandstone Coral look currently shipping on `dev` (founder ruling,
 * ADR-0081 amendment 2026-07-17 — "the extraction baseline and zero-visual-regression
 * constraint are measured against current `dev`"). It is the free, default layout.
 *
 * This package intentionally does NOT duplicate page logic: it re-exports the existing,
 * already-shared page components verbatim. Extraction here means "declare these pages as
 * the classic layout's page set in the registry", not "fork/copy their source" — forking
 * would violate the shared-component-library rule (ADR-0081 D1) and risk duplicating
 * booking/payment/listing-data logic into the theme package.
 */
import HomePage from "@/pages/home/Home";
import PropertyDetailsPage from "@/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails";
import AboutPageComponent from "@/pages/AboutPage";
import GalleryPageComponent from "@/pages/GalleryPage";
import ContactUsPage from "@/pages/contactus/ContactUs";
import type { LayoutThemeModule } from "../types";

export const Home = HomePage;
export const PropertyDetails = PropertyDetailsPage;
export const About = AboutPageComponent;
export const Gallery = GalleryPageComponent;
export const Contact = ContactUsPage;

// Compile-time-only check that this module's exports satisfy LayoutThemeModule's shape.
const _classicShapeCheck: LayoutThemeModule = { Home, PropertyDetails, About, Gallery, Contact };
void _classicShapeCheck;
