import { Link } from "react-router-dom";
import SEO from "../../components/SEO";
import { blogPosts } from "../../data/blogPosts";

const BlogHome = () => {
  return (
    <div className="px-4 md:px-10 lg:px-20 py-24 bg-bg-muted min-h-screen">
      <SEO
        title="Atlas Homestays Blog"
        description="Guest guides, hospitality technology, and updates from Atlas Homestays."
      />
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-3">
          <p className="uppercase tracking-[0.2em] text-primary font-semibold">Atlas Homestays</p>
          <h1 className="text-4xl font-bold text-text-primary">Blog</h1>
          <p className="text-lg text-text-muted">
            Explore travel tips, guest guides, and hospitality technology that powers Atlas Homestays.
          </p>
        </div>

        <div className="flex gap-4 flex-wrap">
          <Link to="/blog/guest-guides" className="btn-chip">
            Guest Guides
          </Link>
          <Link to="/blog/hospitality-tech" className="btn-chip">
            Hospitality Tech &amp; AI
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {blogPosts.map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`} className="bg-bg-surface p-5 rounded-2xl border border-border-subtle shadow-level1 hover:shadow-level2 transition">
              {post.featuredImage && (
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full h-40 object-cover rounded-xl mb-4"
                  loading="lazy"
                />
              )}
              <p className="text-sm uppercase tracking-[0.18em] text-primary font-semibold">
                {post.category === "guest-guides" ? "Guest Guides" : "Hospitality Tech & AI"}
              </p>
              <h2 className="text-xl font-semibold text-text-primary mt-2">{post.title}</h2>
              <p className="text-text-muted mt-2">{post.excerpt}</p>
              <span className="text-primary font-semibold mt-3 inline-flex">Read more</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BlogHome;
