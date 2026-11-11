import { buildPoweredByAtlasUrl, POWERED_BY_ATLAS_LABEL, type PoweredByAtlasMedium } from '../tenant/poweredByAtlas';

type Props = {
  slug: string | null | undefined;
  medium: PoweredByAtlasMedium;
  className?: string;
};

/**
 * TASK-10299421: quiet "Powered by Atlas" link. Opens in a new tab so a guest mid-booking never
 * loses the page; inline text only, so it cannot push a booking button or break a phone footer.
 */
export default function PoweredByAtlasLink({ slug, medium, className }: Props) {
  return (
    <a
      data-testid="powered-by-atlas"
      href={buildPoweredByAtlasUrl(slug, medium)}
      target="_blank"
      rel="noopener"
      className={className ?? 'underline-offset-2 hover:underline hover:text-[var(--footer-link-hover)] transition-colors'}
    >
      {POWERED_BY_ATLAS_LABEL}
    </a>
  );
}
