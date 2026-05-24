import React from 'react';
import { Link } from 'react-router-dom';
import { getTenantContext } from '../../tenant/tenantContext';
import { getTenantOverrides, shouldHideAtlasBranding } from '../../tenant/tenantOverrides';
import '../homepage_components/atlas-home-v2.css';

type AtlasNeighbourhoodRibbonProps = {
  /** "ribbon" (default) is the full strip between hero and grid; "closer" is the calm one-liner under the grid. */
  variant?: 'ribbon' | 'closer';
};

/**
 * A thin location strip that bridges the hero and the "Our Homes" grid, giving
 * the first scroll a heartbeat: hero → place → homes. The KPHB copy is
 * Atlas-specific, so the strip is hidden on white-label tenant subdomains
 * (RA-006) where neighbourhood data isn't yet wired through.
 */
const AtlasNeighbourhoodRibbon: React.FC<AtlasNeighbourhoodRibbonProps> = ({ variant = 'ribbon' }) => {
  const tenant = getTenantContext();
  // KPHB copy applies to Atlas surfaces (marketplace root + the `atlas` tenant)
  // only — hidden on white-label tenants, matching the rest of the page (RA-006).
  const showAtlasContent = !shouldHideAtlasBranding(tenant, getTenantOverrides(tenant?.slug));
  const ref = React.useRef<HTMLElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setVisible(true)),
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  if (!showAtlasContent) return null;

  if (variant === 'closer') {
    return (
      <section className="ahv2-ribbon ahv2-ribbon--closer" aria-label="Neighbourhood note">
        <span className="ahv2-ribbon-left">
          <span className="ahv2-dot" aria-hidden="true" />
          All seven homes are within a 4-minute walk of each other
        </span>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className={`ahv2-ribbon${visible ? ' ahv2-in' : ''}`}
      aria-label="Neighbourhood quick facts"
    >
      <span className="ahv2-ribbon-left">
        <span className="ahv2-dot" aria-hidden="true" />
        Kukatpally · KPHB 7th Phase
      </span>
      <div className="ahv2-ribbon-middle">
        <span className="ahv2-ribbon-stat">2 min to metro</span>
        <span className="ahv2-ribbon-stat">8 min to HITEC City</span>
        <span className="ahv2-ribbon-stat">24/7 owner on-call</span>
      </div>
      <Link className="ahv2-ribbon-right" to="/location">
        See the neighbourhood
        <span className="ahv2-arrow" aria-hidden="true">→</span>
      </Link>
    </section>
  );
};

export default AtlasNeighbourhoodRibbon;
