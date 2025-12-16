interface SectionNavProps {
  sections: { id: string; label: string }[];
}

const SectionNav = ({ sections }: SectionNavProps) => {
  if (!sections.length) return null;

  return (
    <nav
      aria-label="Section navigation"
      className="sticky top-24 bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-fit"
    >
      <p className="text-sm font-semibold text-slate-800 mb-3">Jump to section</p>
      <ul className="space-y-2 text-sm">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="text-slate-700 hover:text-primary font-medium"
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
