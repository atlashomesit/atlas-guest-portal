/**
 * TASK-4925 / ADR-0081 D8 — "photoFirst" layout theme ("minimal photo-first").
 *
 * Near-zero chrome, huge full-bleed photography, sticky booking bar (founder-specified visual
 * direction, epic §2/§3.1, ADR-0081 D8). Only `Home` genuinely diverges from `classic` —
 * `PropertyDetails`/`About`/`Gallery`/`Contact` are re-exported from the current, shared page
 * components verbatim — reusing them (not forking) is the deliberate choice per this task's
 * stop-and-ask ("do not duplicate booking/payment/listing-fetch logic into the theme package —
 * compose the existing shared components only"), same precedent `noir/index.tsx`/
 * `coastal/index.tsx` (TASK-4906/4907) already established.
 */
import PhotoFirstHome from './Home';
import PropertyDetailsComponent from '@/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails';
import AboutPageComponent from '@/pages/AboutPage';
import GalleryPageComponent from '@/pages/GalleryPage';
import ContactUsPage from '@/pages/contactus/ContactUs';
import type { LayoutThemeModule } from '../types';

export const Home = PhotoFirstHome;
export const PropertyDetails = PropertyDetailsComponent;
export const About = AboutPageComponent;
export const Gallery = GalleryPageComponent;
export const Contact = ContactUsPage;

// Compile-time-only check that this module's exports satisfy LayoutThemeModule's shape.
const _photoFirstShapeCheck: LayoutThemeModule = { Home, PropertyDetails, About, Gallery, Contact };
void _photoFirstShapeCheck;
