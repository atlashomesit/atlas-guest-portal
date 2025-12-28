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
    { label: 'Home', to: '/' },
    { label: 'Our Homes', to: '/#our-homes' },
    { label: 'Location', to: '/location' },
    { label: 'Contact', to: '/contact' },
];

export const moreNav: NavItem[] = [
    { label: 'Gallery', to: '/gallery' },
    { label: 'About Us', to: '/about' },
    { label: 'Articles', to: '/blog' },
    { label: 'Offers', to: '/offers' },
];

export const ctaNav: NavItem = { label: 'Book Now', to: '/search' };
