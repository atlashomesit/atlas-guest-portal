/**
 * TASK-4924 / ADR-0081 D8 — "editorial" layout theme ("editorial magazine").
 *
 * Only `Home` genuinely diverges from `classic` in composition — the founder's brief
 * (text-forward composition, serif display typography, story-driven section flow) is
 * primarily a front-door/homepage statement (epic §3.1, ATLAS-DEVELOPER-TASKS.md
 * TASK-4924). `PropertyDetails`, `About`, `Gallery`, and `Contact` are re-exported from the
 * current, shared page components verbatim — reusing them (not forking) is the deliberate
 * choice per this task's stop-and-ask ("do not duplicate booking/payment/listing-fetch logic
 * into the theme package — compose the existing shared components only, even when the
 * surrounding page composition diverges significantly"). These pages already consume the
 * CSS-variable design-token system throughout (`bg-bg-*`, `text-text-*`, `border-border-*`
 * Tailwind classes bound to `src/styles/theme.ts` custom properties), so editorial's
 * paper/ink/burgundy palette (`defaultColorTokens.ts`, or a resolved
 * loversRetreatBlush/auroraChampagne/jetsetPearl color preset) repaints them automatically
 * with no structural fork required.
 */
import EditorialHome from './Home';
import PropertyDetailsComponent from '@/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails';
import AboutPageComponent from '@/pages/AboutPage';
import GalleryPageComponent from '@/pages/GalleryPage';
import ContactUsPage from '@/pages/contactus/ContactUs';
import type { LayoutThemeModule } from '../types';

export const Home = EditorialHome;
export const PropertyDetails = PropertyDetailsComponent;
export const About = AboutPageComponent;
export const Gallery = GalleryPageComponent;
export const Contact = ContactUsPage;

// Compile-time-only check that this module's exports satisfy LayoutThemeModule's shape.
const _editorialShapeCheck: LayoutThemeModule = { Home, PropertyDetails, About, Gallery, Contact };
void _editorialShapeCheck;
