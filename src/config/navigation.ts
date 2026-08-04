export type NavItem = {
    label: string;
    to: string;
    external?: boolean;
    hidden?: boolean;
};

export const helpNav: NavItem[] = [
    { label: 'Policies', to: '/policies' },
    { label: 'FAQs', to: '/faq' },
    { label: 'Terms', to: '/terms' },
];

export const primaryNav: NavItem[] = [
    { label: 'Stays', to: '/#our-homes' },
    { label: 'Location', to: '/location' },
    { label: 'Trips', to: '/search' },
    { label: 'Help', to: '/contact' },
];

export const moreNav: NavItem[] = [
    { label: 'Gallery', to: '/gallery' },
    { label: 'Amenities', to: '/amenities' },
    { label: 'About Us', to: '/about' },
    { label: 'Articles', to: '/blog' },
    { label: 'Offers', to: '/offers' },
];

/** TASK-3937: account links under Trips menu */
export const tripsMenuNav: NavItem[] = [
    { label: 'Search stays', to: '/search' },
    { label: 'My bookings', to: '/my-bookings' },
    { label: 'Recently viewed', to: '/recent' },
    { label: 'My profile', to: '/profile' },
];

export const ctaNav: NavItem = { label: 'Book Now', to: '/search' };
