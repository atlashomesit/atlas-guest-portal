/**
 * TASK-4914 / ADR-0081 D8 — "heritage" layout theme.
 *
 * The pre-coral Atlas guest-portal look, recovered from git history (`d1ab2590^` — the
 * commit immediately before the "Sandstone Coral" re-theme, ADR-0081 amendment
 * 2026-07-17 pt.4). Preserved so Atlas — or any tenant — can switch back to it with a
 * single `WebsiteThemeId` DB update (epic AC7), with zero visual drift from what shipped
 * on `dev` up to that commit.
 *
 * Only `Home` and `PropertyDetails` genuinely diverge from `classic` — the coral redesign
 * (`d1ab2590`) touched exactly those two pages' composition (plus shared, non-page-level
 * components consumed unchanged by both layouts). `About`, `Gallery`, and `Contact` were
 * never touched by that redesign, so heritage re-exports the same current, shared page
 * components `classic` uses for them — recovering nothing because nothing diverged.
 */
import HomepageComponent from "./Home";
import PropertyDetailsComponent from "./PropertyDetails";
import AboutPageComponent from "@/pages/AboutPage";
import GalleryPageComponent from "@/pages/GalleryPage";
import ContactUsPage from "@/pages/contactus/ContactUs";
import type { LayoutThemeModule } from "../types";

export const Home = HomepageComponent;
export const PropertyDetails = PropertyDetailsComponent;
export const About = AboutPageComponent;
export const Gallery = GalleryPageComponent;
export const Contact = ContactUsPage;

// Compile-time-only check that this module's exports satisfy LayoutThemeModule's shape.
const _heritageShapeCheck: LayoutThemeModule = { Home, PropertyDetails, About, Gallery, Contact };
void _heritageShapeCheck;
