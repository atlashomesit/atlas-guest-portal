/**
 * "Elite Experiences / Discover Our Exclusive Services" used to render the same boilerplate on every
 * host's site (airport pickup, self check-in, long-stay discounts...), promising services a host may
 * not offer (first-impression judge, 2026-11-10). There is no host-enabled services data on the
 * tenant/site config yet, so host sites render nothing here. When such data exists, render only the
 * host's enabled services from it and keep hiding the section when the list is empty.
 */
const ServicesSection = () => null;

export default ServicesSection;
