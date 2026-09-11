import OptimizedImage from "@/components/ui/OptimizedImage";

const CARD_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

/**
 * TASK-10090: saved-home / recently-viewed cover through the existing OptimizedImage
 * transform path. 40-unit (h-40) card geometry is preserved; ineligible URLs fall
 * back inside OptimizedImage rather than white-screening the card.
 */
export default function SavedHomeCover({ src, alt }: { src?: string | null; alt: string }) {
  if (!src?.trim()) {
    return <div className="w-full h-40 bg-bg-muted" aria-hidden data-testid="saved-home-cover-empty" />;
  }
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      className="w-full h-40 object-cover"
      wrapperClassName="w-full h-40"
      sizes={CARD_SIZES}
      loading="lazy"
    />
  );
}
