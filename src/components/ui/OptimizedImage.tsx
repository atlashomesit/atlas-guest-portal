import React from "react";
import { sanitizeGuestImageUrl } from "@/utils/guestImageUrl";

const RESPONSIVE_WIDTHS = [480, 768, 1200];

const DEFAULT_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

const PLACEHOLDER_CLASS =
  "bg-bg-muted bg-[linear-gradient(135deg,color-mix(in_srgb,var(--border-subtle)_55%,transparent)_0%,color-mix(in_srgb,var(--bg-muted)_92%,transparent)_100%)]";

/** imgproxy-style params break Azure private blobs and are ignored by most static file hosts */
function shouldBuildResponsiveSrcSet(src: string): boolean {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://example.invalid";
    const url = new URL(src, base);
    if (url.hostname.includes("blob.core.windows.net")) return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return false;
    if (url.pathname.includes("/uploads/")) return false;
    return true;
  } catch {
    return false;
  }
}

const buildResponsiveSrcSet = (src: string, widths: number[] = RESPONSIVE_WIDTHS) => {
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
  ...props
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const safeSrc = React.useMemo(() => sanitizeGuestImageUrl(src), [src]);

  React.useEffect(() => {
    setIsLoaded(false);
    setLoadFailed(false);
  }, [safeSrc]);

  const computedSrcSet = React.useMemo(() => {
    if (srcSet != null) return srcSet;
    if (!safeSrc) return undefined;
    const built = buildResponsiveSrcSet(safeSrc);
    return built;
  }, [srcSet, safeSrc]);

  const showPlaceholder = !safeSrc || loadFailed;

  if (showPlaceholder) {
    return (
      <div
        className={`relative block overflow-hidden ${PLACEHOLDER_CLASS} ${wrapperClassName ?? ""} ${className ?? ""}`.trim()}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      />
    );
  }

  return (
    <div className={`relative block overflow-hidden bg-[color:color-mix(in_srgb,var(--bg-muted)_85%,transparent)] ${wrapperClassName ?? ""}`}>
      {showSkeleton && (
        <div
          className={`absolute inset-0 animate-pulse bg-gradient-to-br from-[color:color-mix(in_srgb,var(--border-subtle)_75%,transparent)] to-[color:color-mix(in_srgb,var(--bg-surface)_88%,transparent)] transition-opacity duration-300 ${
            isLoaded ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden
        />
      )}
      <img
        {...props}
        alt={alt}
        className={`transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
        decoding={decoding}
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
        src={safeSrc}
        srcSet={computedSrcSet}
      />
    </div>
  );
};

export default OptimizedImage;
