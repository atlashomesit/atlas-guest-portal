interface SectionNavProps {
  sections: { id: string; label: string }[];
}

const SectionNav = ({ sections }: SectionNavProps) => {
  if (!sections.length) return null;

  return (
    <nav
      aria-label="Section navigation"
      className="sticky top-24 bg-bg-surface border border-border-subtle rounded-xl p-4 shadow-sm h-fit z-[var(--z-sticky)]"
    >
      <p className="text-sm font-semibold text-text-primary mb-3">Jump to section</p>
      <ul className="space-y-2 text-sm">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="text-text-muted hover:text-[var(--accent-text)] font-medium"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default SectionNav;
