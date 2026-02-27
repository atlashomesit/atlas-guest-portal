import { useEffect } from "react";

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

    if (url) {
      const ogUrl = ensureMeta("og:url", "property");
      ogUrl.content = url;

      let canonical = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = url;
    }

    if (image) {
      const ogImage = ensureMeta("og:image", "property");
      ogImage.content = image;
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

    if (image) {
      const twitterImage = ensureMeta("twitter:image");
      twitterImage.content = image;
    }

    if (twitterSite) {
      const twitterSiteMeta = ensureMeta("twitter:site");
      twitterSiteMeta.content = twitterSite;
    }

    if (twitterCreator) {
      const twitterCreatorMeta = ensureMeta("twitter:creator");
      twitterCreatorMeta.content = twitterCreator;
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
  ]);

  return null;
};

export default SEO;
