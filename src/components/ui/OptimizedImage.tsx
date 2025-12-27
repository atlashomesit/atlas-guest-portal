import React from "react";

const RESPONSIVE_WIDTHS = [480, 768, 1200];

const DEFAULT_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

const buildResponsiveSrcSet = (src: string, widths: number[] = RESPONSIVE_WIDTHS) => {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
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

  React.useEffect(() => {
    setIsLoaded(false);
  }, [src]);

  const computedSrcSet = React.useMemo(() => srcSet ?? buildResponsiveSrcSet(src), [srcSet, src]);

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
        onLoad={(event) => {
          setIsLoaded(true);
          props.onLoad?.(event);
        }}
        sizes={sizes}
        src={src}
        srcSet={computedSrcSet}
      />
    </div>
  );
};

export default OptimizedImage;
