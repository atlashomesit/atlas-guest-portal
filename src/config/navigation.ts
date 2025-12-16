export type NavItem = {
    label: string;
    to: string;
    external?: boolean;
    hidden?: boolean;
};

export const primaryNav: NavItem[] = [
    { label: 'Apartments', to: '/apartments' },
    { label: 'Location', to: '/location' },
    { label: 'FAQ', to: '/faq' },
    { label: 'Policies', to: '/policies' },
    { label: 'Terms', to: '/terms' },
    { label: 'Contact', to: '/contact' },
];

export const moreNav: NavItem[] = [
    { label: 'Gallery', to: '/gallery' },
    { label: 'About Us', to: '/about' },
    { label: 'Articles', to: '/blog' },
    { label: 'Offers', to: '/offers' },
];

export const ctaNav: NavItem = { label: 'Book Now', to: '/book-now' };
