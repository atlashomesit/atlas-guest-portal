// TASK-102165: native-style bottom navigation for the mobile marketplace viewport.
// Renders only below the md breakpoint (768px); desktop keeps the existing header.
import { NavLink } from 'react-router-dom';
import { FaCompass, FaHeart, FaSuitcase, FaHeadset } from 'react-icons/fa';

const TABS = [
  { id: 'explore', label: 'Explore', to: '/', icon: FaCompass },
  { id: 'wishlists', label: 'Wishlists', to: '/favorites', icon: FaHeart },
  { id: 'bookings', label: 'Bookings', to: '/my-bookings', icon: FaSuitcase },
  { id: 'support', label: 'Support', to: '/contact', icon: FaHeadset },
] as const;

export default function MobileMarketplaceNav() {
  return (
    <nav
      aria-label="Marketplace"
      data-testid="marketplace-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-surface md:hidden"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <div className="grid grid-cols-4">
        {TABS.map(({ id, label, to, icon: Icon }) => (
          <NavLink
            key={id}
            to={to}
            end={to === '/'}
            data-testid={`marketplace-bottom-nav-${id}`}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors ${
                isActive ? 'font-semibold text-accent-primary' : 'font-normal text-text-muted'
              }`
            }
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
