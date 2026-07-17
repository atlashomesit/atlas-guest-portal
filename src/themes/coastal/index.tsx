/**
 * TASK-4907 / ADR-0081 D8 — "coastal" layout theme.
 *
 * "Coastal airy": light sea-blue palette, horizontal gallery layouts, wave-motif accents
 * (founder-specified visual direction, epic §3.1/§3.9, ADR-0081 D8). Only `Home` genuinely
 * diverges from `classic` — the horizontal listings gallery and wave motifs are a homepage
 * composition change; `PropertyDetails`/`About`/`Gallery`/`Contact` were not part of the
 * founder's visual-direction brief for this layout, so this package re-exports the same
 * current, shared page components `classic` uses for them (same "recover/build composition,
 * not fork logic" precedent already established by `heritage`, TASK-4914 — About/Gallery/
 * Contact re-exported there for the identical reason: nothing about this layout's brief
 * requires them to diverge).
 */
import CoastalHomeComponent from "./Home";
import PropertyDetailsComponent from "../../components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails";
import AboutPageComponent from "../../pages/AboutPage";
import GalleryPageComponent from "../../pages/GalleryPage";
import ContactUsPage from "../../pages/contactus/ContactUs";
import type { LayoutThemeModule } from "../types";

export const Home = CoastalHomeComponent;
export const PropertyDetails = PropertyDetailsComponent;
export const About = AboutPageComponent;
export const Gallery = GalleryPageComponent;
export const Contact = ContactUsPage;

// Compile-time-only check that this module's exports satisfy LayoutThemeModule's shape.
const _coastalShapeCheck: LayoutThemeModule = { Home, PropertyDetails, About, Gallery, Contact };
void _coastalShapeCheck;
