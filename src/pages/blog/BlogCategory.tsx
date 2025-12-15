import { Link, useParams } from "react-router-dom";
import SEO from "../../components/SEO";
import { blogPosts, BlogCategory } from "../../data/blogPosts";

const categoryMeta: Record<BlogCategory, { title: string; description: string; label: string }> = {
  "guest-guides": {
    title: "Guest Guides | Atlas Homestays",
    description: "Destination tips and stay guidance for Atlas Homestays guests.",
    label: "Guest Guides",
  },
  "hospitality-tech": {
    title: "Hospitality Tech & AI | Atlas Homestays",
    description: "Technology updates and automation powering Atlas Homestays.",
    label: "Hospitality Tech & AI",
  },
};

const BlogCategory = () => {
  const { category } = useParams();
  const safeCategory = (category as BlogCategory) || "guest-guides";
  const meta = categoryMeta[safeCategory];
  const filtered = blogPosts.filter((post) => post.category === safeCategory);

  return (
    <div className="px-4 md:px-10 lg:px-20 py-24 bg-gray-50 min-h-screen">
      <SEO title={meta.title} description={meta.description} />
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-3">
          <p className="uppercase tracking-[0.2em] text-primary font-semibold">Atlas Homestays</p>
          <h1 className="text-4xl font-bold text-slate-900">{meta.label}</h1>
          <p className="text-lg text-slate-600">{meta.description}</p>
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
            <Link key={post.id} to={`/blog/${post.slug}`} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
              {post.featuredImage && (
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full h-40 object-cover rounded-xl mb-4"
                  loading="lazy"
                />
              )}
              <h2 className="text-xl font-semibold text-slate-900">{post.title}</h2>
              <p className="text-slate-600 mt-2">{post.excerpt}</p>
              <span className="text-primary font-semibold mt-3 inline-flex">Read more</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BlogCategory;
