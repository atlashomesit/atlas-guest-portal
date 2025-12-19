import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { NavItem } from '../../config/navigation';

interface MoreMenuProps {
    items: NavItem[];
    onNavigate?: () => void;
}

const MoreMenu = ({ items, onNavigate }: MoreMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const firstItemRef = useRef<HTMLAnchorElement | null>(null);

    const closeMenu = () => {
        setIsOpen(false);
        buttonRef.current?.focus();
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && menuRef.current && !menuRef.current.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
                closeMenu();
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                event.preventDefault();
                closeMenu();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && firstItemRef.current) {
            firstItemRef.current.focus();
        }
    }, [isOpen]);

    const visibleItems = items.filter((item) => !item.hidden);

    return (
        <div className="relative">
            <button
                type="button"
                ref={buttonRef}
                className="px-3 py-2 text-sm font-semibold text-text-primary hover:text-primary flex items-center gap-1"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-controls="more-menu"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                More
            </button>

            {isOpen && (
                <div
                    id="more-menu"
                    ref={menuRef}
                    role="menu"
                    className="absolute right-0 mt-2 bg-bg-surface border border-border-subtle rounded-xl shadow-level2 min-w-[180px] py-2 z-10"
                >
                    {visibleItems.map((item, index) => (
                        item.external ? (
                            <a
                                key={item.label}
                                href={item.to}
                                onClick={() => {
                                    setIsOpen(false);
                                    onNavigate?.();
                                }}
                                target="_blank"
                                rel="noopener noreferrer"
                                role="menuitem"
                                className="block px-4 py-2 text-sm text-text-primary hover:bg-bg-muted focus:bg-bg-muted focus:outline-none"
                                ref={index === 0 ? firstItemRef : undefined}
                            >
                                {item.label}
                            </a>
                        ) : (
                            <NavLink
                                key={item.label}
                                to={item.to}
                                onClick={() => {
                                    setIsOpen(false);
                                    onNavigate?.();
                                }}
                                role="menuitem"
                                className={({ isActive }) =>
                                    `block px-4 py-2 text-sm hover:bg-bg-muted focus:bg-bg-muted focus:outline-none ${isActive ? 'text-primary' : 'text-text-primary'}`
                                }
                                ref={index === 0 ? firstItemRef : undefined}
                                tabIndex={-1}
                            >
                                {item.label}
                            </NavLink>
                        )
                    ))}
                </div>
            )}
        </div>
    );
};

export default MoreMenu;
