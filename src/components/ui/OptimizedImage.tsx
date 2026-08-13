import React from "react";
import {
  buildGuestImageSrcSet,
  sanitizeGuestImageUrl,
  toTransformedGuestImageUrl,
} from "@/utils/guestImageUrl";

const RESPONSIVE_WIDTHS = [480, 768, 1200];

const DEFAULT_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

const PLACEHOLDER_CLASS =
  "bg-bg-muted bg-[linear-gradient(135deg,color-mix(in_srgb,var(--border-subtle)_55%,transparent)_0%,color-mix(in_srgb,var(--bg-muted)_92%,transparent)_100%)]";

/**
 * TASK-7433 / TASK-7821: Azure Blob Storage ignores imgix-style ?w= / ?auto=format params.
 * Blob URLs are rewritten through `/img` (see `buildGuestImageSrcSet`) rather than this
 * query-param builder. Only emit decorative ?w= srcset for origins that honour it.
 */
export function shouldBuildResponsiveSrcSet(src: string): boolean {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://example.invalid";
    const url = new URL(src, base);
    if (url.hostname.includes("blob.core.windows.net")) return false;
    if (url.pathname === "/img" || url.pathname.startsWith("/img?")) return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return false;
    if (url.pathname.includes("/uploads/")) return false;
    return true;
  } catch {
    return false;
  }
}

export const buildResponsiveSrcSet = (src: string, widths: number[] = RESPONSIVE_WIDTHS) => {
  try {
    if (!shouldBuildResponsiveSrcSet(src)) return undefined;
    const base = typeof window !== "undefined" ? window.location.origin : "https://example.invalid";
    const url = new URL(src, base);

    return widths
      .map((width) => {
        const next = new URL(url);
        next.searchParams.set("w", String(width));
        next.searchParams.set("auto", "format");
        return `${next.toString()} ${width}w`;
      })
      .join(", ");
  } catch {
    return undefined;
  }
};

export type OptimizedImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes"> & {
  src: string;
  srcSet?: string;
  sizes?: string;
  wrapperClassName?: string;
  showSkeleton?: boolean;
};

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  alt,
  className,
  decoding = "async",
  loading = "lazy",
  sizes = DEFAULT_SIZES,
  src,
  srcSet,
  wrapperClassName,
  showSkeleton = true,
  fetchPriority,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const safeSrc = React.useMemo(() => sanitizeGuestImageUrl(src), [src]);
  const displaySrc = React.useMemo(
    () => (safeSrc ? toTransformedGuestImageUrl(safeSrc, 768) ?? safeSrc : undefined),
    [safeSrc],
  );

  React.useEffect(() => {
    setIsLoaded(false);
    setLoadFailed(false);
  }, [displaySrc]);

  const computedSrcSet = React.useMemo(() => {
    if (srcSet != null) return srcSet;
    if (!safeSrc) return undefined;
    const blobSrcSet = buildGuestImageSrcSet(safeSrc);
    if (blobSrcSet) return blobSrcSet;
    return buildResponsiveSrcSet(safeSrc);
  }, [srcSet, safeSrc]);

  const showPlaceholder = !safeSrc || loadFailed;

  if (showPlaceholder) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${PLACEHOLDER_CLASS} ${wrapperClassName ?? ""} ${className ?? ""}`.trim()}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-10 w-10 text-[color:color-mix(in_srgb,var(--text-muted)_42%,transparent)]"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.6" />
          <path d="m21 15-4.5-4.5L5 21.5" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative block overflow-hidden bg-[color:color-mix(in_srgb,var(--bg-muted)_85%,transparent)] ${wrapperClassName ?? ""}`}>
      {showSkeleton && (
        <div
          className={`absolute inset-0 bg-[color:color-mix(in_srgb,var(--border-subtle)_55%,var(--bg-surface)_45%)] ${
            isLoaded ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden
        />
      )}
      <img
        {...props}
        alt={alt}
        className={`${isLoaded ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
        decoding={decoding}
        fetchPriority={fetchPriority}
        loading={loading}
        onError={(event) => {
          setLoadFailed(true);
          props.onError?.(event);
        }}
        onLoad={(event) => {
          setIsLoaded(true);
          props.onLoad?.(event);
        }}
        sizes={sizes}
        src={displaySrc}
        srcSet={computedSrcSet}
      />
    </div>
  );
};

export default OptimizedImage;
