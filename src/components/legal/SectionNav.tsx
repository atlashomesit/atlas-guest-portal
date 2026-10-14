import { useId, useState, type MouseEvent } from "react";

interface SectionNavProps {
  sections: { id: string; label: string }[];
  collapsibleOnMobile?: boolean;
}

const SectionNav = ({ sections, collapsibleOnMobile = false }: SectionNavProps) => {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const goToTopic = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!collapsibleOnMobile || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    setExpanded(false);
    window.location.hash = id;
    requestAnimationFrame(() => {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start" });
    });
  };
  if (!sections.length) return null;

  return (
    <nav
      aria-label="Section navigation"
      className={`sticky top-24 bg-bg-surface border border-border-subtle rounded-xl p-4 shadow-sm h-fit z-[var(--z-sticky)] ${collapsibleOnMobile ? "section-nav--collapsible" : ""} ${expanded ? "section-nav--expanded" : ""}`}
    >
      <p className="section-nav-label text-sm font-semibold text-text-primary mb-3">{collapsibleOnMobile ? "Jump to a topic" : "Jump to section"}</p>
      {collapsibleOnMobile && <button type="button" className="section-nav-toggle" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>Jump to a topic</button>}
      <ul id={listId} className="space-y-2 text-sm">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={(event) => goToTopic(event, section.id)}
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
