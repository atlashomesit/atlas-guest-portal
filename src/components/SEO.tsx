import { useEffect } from "react";
import { getTenantContext } from "../tenant/tenantContext";

// Default OG/Twitter preview image shipped in index.html. Used as the fallback when a route
// renders <SEO> without an `image` on Platform/marketplace hosts only.
// TASK-7468 #5: Neutral / white-label hosts must NOT fall back to this Atlas-branded asset.
// Uses getTenantContext only (not displayBrand helpers) so page tests that mock displayBrand
// without exporting isNeutralBrandingMode keep working.
const DEFAULT_OG_IMAGE = "/og-image.svg";

function resolveOgImageFallback(explicit?: string): string {
  if (explicit) return explicit;
  const ctx = getTenantContext();
  const isWhiteLabel = Boolean(ctx?.legalContactPack?.isCustomDomain);
  const isNeutral = ctx?.guestCommsBrandingMode === "Neutral";
  if (isWhiteLabel || isNeutral) return "";
  return DEFAULT_OG_IMAGE;
}

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  twitterSite?: string;
  twitterCreator?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /**
   * TASK-2739-v1: value for `<meta name="robots">` (e.g. "noindex, nofollow"). When set, a
   * managed robots meta is injected so search engines skip Draft listings; when undefined the
   * managed tag is removed so navigating to a live page does not leave a stale noindex behind.
   */
  robots?: string;
}

const SEO = ({
  title,
  description,
  image,
  url,
  type = "website",
  twitterCard,
  twitterSite,
  twitterCreator,
  jsonLd,
  robots,
}: SEOProps) => {
  const serializedJsonLd = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    if (title) {
      document.title = title;
    }

    const ensureMeta = (name: string, attr: "name" | "property" = "name") => {
      let meta = document.head.querySelector(`meta[${attr}='${name}']`) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      return meta;
    };

    if (description) {
      const descriptionMeta = ensureMeta("description");
      descriptionMeta.content = description;
    }

    const ogTitle = ensureMeta("og:title", "property");
    ogTitle.content = title;

    if (description) {
      const ogDescription = ensureMeta("og:description", "property");
      ogDescription.content = description;
    }

    // Always reset canonical + og:url (to the route's url, or "" which self-references the
    // current page like index.html's default) so a prior route's URL never persists after
    // client-side navigation to a page that does not pass `url`.
    const ogUrl = ensureMeta("og:url", "property");
    ogUrl.content = url ?? "";

    let canonical = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url ?? "";

    const resolvedImage = resolveOgImageFallback(image);
    const ogImage = ensureMeta("og:image", "property");
    if (resolvedImage) {
      ogImage.content = resolvedImage;
    } else {
      ogImage.remove();
    }

    const ogType = ensureMeta("og:type", "property");
    ogType.content = type;

    const resolvedTwitterCard = twitterCard ?? (image ? "summary_large_image" : "summary");
    const twitterCardMeta = ensureMeta("twitter:card");
    twitterCardMeta.content = resolvedTwitterCard;

    const twitterTitle = ensureMeta("twitter:title");
    twitterTitle.content = title;

    if (description) {
      const twitterDescription = ensureMeta("twitter:description");
      twitterDescription.content = description;
    }

    const twitterImage = ensureMeta("twitter:image");
    if (resolvedImage) {
      twitterImage.content = resolvedImage;
    } else {
      twitterImage.remove();
    }

    if (twitterSite) {
      const twitterSiteMeta = ensureMeta("twitter:site");
      twitterSiteMeta.content = twitterSite;
    }

    if (twitterCreator) {
      const twitterCreatorMeta = ensureMeta("twitter:creator");
      twitterCreatorMeta.content = twitterCreator;
    }

    // TASK-2739-v1: Draft listings inject a noindex robots meta; cleanup removes our managed tag
    // (marked with data-seo-robots) when robots is unset so live pages stay indexable.
    const managedRobots = document.head.querySelector(
      "meta[data-seo-robots]",
    ) as HTMLMetaElement | null;
    if (robots) {
      const robotsMeta = managedRobots ?? document.createElement("meta");
      robotsMeta.setAttribute("name", "robots");
      robotsMeta.setAttribute("data-seo-robots", "true");
      robotsMeta.content = robots;
      if (!managedRobots) {
        document.head.appendChild(robotsMeta);
      }
    } else if (managedRobots) {
      managedRobots.remove();
    }

    const jsonLdSelector = "script[data-seo-json-ld]";
    const existingJsonLd = document.head.querySelector(jsonLdSelector) as HTMLScriptElement | null;

    if (serializedJsonLd) {
      const scriptTag = existingJsonLd ?? document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.setAttribute("data-seo-json-ld", "true");
      scriptTag.textContent = serializedJsonLd;

      if (!existingJsonLd) {
        document.head.appendChild(scriptTag);
      }
    } else if (existingJsonLd) {
      existingJsonLd.remove();
    }
  }, [
    title,
    description,
    image,
    url,
    type,
    twitterCard,
    twitterSite,
    twitterCreator,
    serializedJsonLd,
    robots,
  ]);

  return null;
};

export default SEO;
