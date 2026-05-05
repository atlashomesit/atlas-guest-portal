import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import SEO from "../../components/SEO";
import { getLocalizedBlogPosts, BlogCategory as BlogCategoryType } from "../../data/blogPosts";
import { getTenantBrandName } from "../../tenant/displayBrand";

const BlogCategory = () => {
  const brandName = getTenantBrandName();
  const posts = useMemo(() => getLocalizedBlogPosts(brandName), [brandName]);

  const categoryMeta: Record<BlogCategoryType, { title: string; description: string; label: string }> = {
    "guest-guides": {
      title: `Guest Guides | ${brandName}`,
      description: `Destination tips and stay guidance for ${brandName} guests.`,
      label: "Guest Guides",
    },
    "hospitality-tech": {
      title: `Hospitality Tech & AI | ${brandName}`,
      description: `Technology updates and automation powering ${brandName}.`,
      label: "Hospitality Tech & AI",
    },
  };

  const isValidCategory = (value: string | undefined): value is BlogCategoryType => {
    return Boolean(value && value in categoryMeta);
  };

  const { category } = useParams();
  const safeCategory: BlogCategoryType = isValidCategory(category) ? category : "guest-guides";
  const meta = categoryMeta[safeCategory];
  const filtered = posts.filter((post) => post.category === safeCategory);

  return (
    <div className="px-4 md:px-10 lg:px-20 py-24 bg-bg-muted min-h-screen">
      <SEO title={meta.title} description={meta.description} />
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-3">
          <p className="uppercase tracking-[0.2em] text-primary font-semibold">{brandName}</p>
          <h1 className="text-4xl font-bold text-text-primary">{meta.label}</h1>
          <p className="text-lg text-text-muted">{meta.description}</p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link to="/blog" className="btn-chip">All Posts</Link>
          <Link to="/blog/guest-guides" className={`btn-chip ${safeCategory === "guest-guides" ? "btn-chip--active" : ""}`}>
            Guest Guides
          </Link>
          <Link to="/blog/hospitality-tech" className={`btn-chip ${safeCategory === "hospitality-tech" ? "btn-chip--active" : ""}`}>
            Hospitality Tech &amp; AI
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {filtered.map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`} className="bg-bg-surface p-5 rounded-2xl border border-border-subtle shadow-level1 hover:shadow-level2 transition">
              {post.featuredImage && (
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full h-40 object-cover rounded-xl mb-4"
                  loading="lazy"
                />
              )}
              <h2 className="text-xl font-semibold text-text-primary">{post.title}</h2>
              <p className="text-text-muted mt-2">{post.excerpt}</p>
              <span className="text-primary font-semibold mt-3 inline-flex">Read more</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BlogCategory;
