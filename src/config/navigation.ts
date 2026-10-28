export type NavItem = {
    label: string;
    to: string;
    href?: string;
    external?: boolean;
    hidden?: boolean;
};

export const helpNav: NavItem[] = [
    { label: 'Policies', to: '/policies', href: '/policies' },
    { label: 'FAQs', to: '/faq', href: '/faq' },
    { label: 'Terms', to: '/terms', href: '/terms' },
    { label: 'Privacy', to: '/privacy', href: '/privacy' },
    { label: 'Contact', to: '/contact', href: '/contact' },
];

export const primaryNav: NavItem[] = [
    { label: 'Stays', to: '/#our-homes', href: '/#our-homes' },
    { label: 'Location', to: '/location', href: '/location' },
    { label: 'Trips', to: '/search', href: '/search' },
    { label: 'Help', to: '/contact', href: '/contact' },
];

export const moreNav: NavItem[] = [
    { label: 'Gallery', to: '/gallery', href: '/gallery' },
    { label: 'Amenities', to: '/amenities', href: '/amenities' },
    { label: 'About Us', to: '/about', href: '/about' },
    { label: 'Articles', to: '/blog', href: '/blog' },
    { label: 'Offers', to: '/offers', href: '/offers' },
];

/** TASK-3937: account links under Trips menu */
export const tripsMenuNav: NavItem[] = [
    { label: 'Search stays', to: '/search', href: '/search' },
    { label: 'My bookings', to: '/my-bookings', href: '/my-bookings' },
    { label: 'Recently viewed', to: '/recent', href: '/recent' },
    { label: 'My profile', to: '/profile', href: '/profile' },
];

/** TASK-10299142: footer legal navigation items with valid hrefs */
export const footerLegalNav: NavItem[] = [
    { label: 'Terms', to: '/terms', href: '/terms' },
    { label: 'Privacy', to: '/privacy', href: '/privacy' },
    { label: 'Contact', to: '/contact', href: '/contact' },
];

/** TASK-10299142: menu navigation items */
export const menuNav: NavItem[] = [
    { label: 'Stays', to: '/#our-homes', href: '/#our-homes' },
    { label: 'Search', to: '/search', href: '/search' },
    { label: 'Terms', to: '/terms', href: '/terms' },
    { label: 'Privacy', to: '/privacy', href: '/privacy' },
    { label: 'Contact', to: '/contact', href: '/contact' },
];

export const ctaNav: NavItem = { label: 'Book Now', to: '/search', href: '/search' };

/** The in-page grid anchor: the tenant storefront's "Our homes" section and the marketplace grid both carry it. */
export const OUR_HOMES_ANCHOR_ID = 'our-homes';

/**
 * TASK-10299142: where a nav/footer link really points.
 *
 * "Stays" is `/#our-homes`. On the tenant storefront that is the right target. In marketplace mode a bare
 * `/#our-homes` drops the whole query (?brand, checkIn, checkOut, guests ...), so the grid reloaded without the
 * guest's dates. There the link keeps the current query (adding `brand=atlastays` when the URL does not already
 * name it, like the `/search` links do) and lands on the marketplace grid, which carries the same anchor id.
 * Every other item, and every item off the marketplace, is returned unchanged.
 */
export function resolveNavTo(
    item: NavItem,
    ctx: { marketplace: boolean; search: string },
): string {
    if (!ctx.marketplace || item.to !== `/#${OUR_HOMES_ANCHOR_ID}`) return item.to;
    const params = new URLSearchParams(ctx.search);
    if (!params.has('brand')) params.set('brand', 'atlastays');
    return `/?${params.toString()}#${OUR_HOMES_ANCHOR_ID}`;
}
