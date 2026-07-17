/**
 * TASK-4906 / ADR-0081 D8 — "noir" layout theme ("dark luxury noir").
 *
 * Only `Home` genuinely diverges from `classic` in composition — the founder's brief
 * (nocturnal palette, gold accents, full-bleed imagery, minimal chrome) is primarily a
 * front-door/hero statement (epic §3.1, ATLAS-DEVELOPER-TASKS.md TASK-4906). `PropertyDetails`,
 * `About`, `Gallery`, and `Contact` are re-exported from the current, shared page components
 * verbatim — reusing them (not forking) is the deliberate choice per this task's stop-and-ask
 * ("do not duplicate booking/payment/listing-fetch logic into the theme package — compose the
 * existing shared components only"). These pages already consume the CSS-variable design-token
 * system throughout (`bg-bg-*`, `text-text-*`, `border-border-*` Tailwind classes bound to
 * `src/styles/theme.ts` custom properties), so noir's dark/gold palette
 * (`defaultColorTokens.ts`, or a resolved `privateIslandNoir`/`emeraldDynasty` color preset)
 * repaints them automatically with no structural fork required.
 */
import NoirHome from './Home';
import PropertyDetailsComponent from '@/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails';
import AboutPageComponent from '@/pages/AboutPage';
import GalleryPageComponent from '@/pages/GalleryPage';
import ContactUsPage from '@/pages/contactus/ContactUs';
import type { LayoutThemeModule } from '../types';

export const Home = NoirHome;
export const PropertyDetails = PropertyDetailsComponent;
export const About = AboutPageComponent;
export const Gallery = GalleryPageComponent;
export const Contact = ContactUsPage;

// Compile-time-only check that this module's exports satisfy LayoutThemeModule's shape.
const _noirShapeCheck: LayoutThemeModule = { Home, PropertyDetails, About, Gallery, Contact };
void _noirShapeCheck;
