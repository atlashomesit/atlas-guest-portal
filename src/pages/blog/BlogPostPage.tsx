import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import SEO from "../../components/SEO";
import { getLocalizedBlogPosts } from "../../data/blogPosts";
import { getTenantBrandName } from "../../tenant/displayBrand";

const BlogPostPage = () => {
  const { slug } = useParams();
  const brandName = getTenantBrandName();
  const posts = useMemo(() => getLocalizedBlogPosts(brandName), [brandName]);
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="px-4 md:px-10 lg:px-20 py-28">
        <h1 className="text-3xl font-bold text-text-primary">Post not found</h1>
        <Link to="/blog" className="text-primary font-semibold mt-4 inline-block">
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-10 lg:px-20 py-24 bg-bg-muted min-h-screen">
      {(() => {
        const canonicalUrl = `https://www.atlastays.com${post.canonicalPath || `/blog/${post.slug}`}`;
        const jsonLd = {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.metaTitle || post.title,
          description: post.metaDescription || post.excerpt,
          image: post.featuredImage ? [post.featuredImage] : undefined,
          mainEntityOfPage: canonicalUrl,
          datePublished: "2026-04-28",
          author: {
            "@type": "Organization",
            name: "Atlas Stays",
          },
          publisher: {
            "@type": "Organization",
            name: "Atlas Stays",
          },
        };
        return (
      <SEO
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.excerpt}
        image={post.featuredImage}
        url={canonicalUrl}
        type="article"
        jsonLd={jsonLd}
      />
        );
      })()}
      <div className="max-w-4xl mx-auto space-y-6 bg-bg-surface p-6 md:p-10 rounded-2xl border border-border-subtle shadow-level1">
        <div className="space-y-2">
          <Link to="/blog" className="text-primary font-semibold">
            Back to Blog
          </Link>
          <p className="text-base uppercase tracking-[0.18em] text-primary font-semibold">
            {post.category === "guest-guides" ? "Guest Guides" : "Hospitality Tech & AI"}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary">{post.title}</h1>
        </div>
        {post.featuredImage && (
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full h-72 object-cover rounded-xl"
            loading="lazy"
          />
        )}
        <p className="text-text-muted leading-relaxed text-lg">{post.content}</p>
        <div className="bg-bg-muted border border-border-subtle rounded-xl p-4">
          <p className="text-sm text-text-muted">
            For booking offers and property policies, explore our Apartments, Offers, and Policies pages.
          </p>
          <div className="flex gap-3 mt-3 flex-wrap">
            <Link to="/#our-homes" className="btn-chip">Our Homes</Link>
            <Link to="/offers" className="btn-chip">Offers</Link>
            <Link to="/policies" className="btn-chip">Policies</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPostPage;
