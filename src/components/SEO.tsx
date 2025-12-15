import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

const SEO = ({ title, description, image, url, type = "website" }: SEOProps) => {
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
    }

    if (image) {
      const ogImage = ensureMeta("og:image", "property");
      ogImage.content = image;
    }

    const ogType = ensureMeta("og:type", "property");
    ogType.content = type;
  }, [title, description, image, url, type]);

  return null;
};

export default SEO;
