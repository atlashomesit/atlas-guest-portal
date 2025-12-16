import { useParams, Link } from "react-router-dom";
import SEO from "../../components/SEO";
import { blogPosts } from "../../data/blogPosts";

const BlogPostPage = () => {
  const { slug } = useParams();
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="px-4 md:px-10 lg:px-20 py-28">
        <h1 className="text-3xl font-bold text-slate-900">Post not found</h1>
        <Link to="/blog" className="text-primary font-semibold mt-4 inline-block">
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-10 lg:px-20 py-24 bg-gray-50 min-h-screen">
      <SEO
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.excerpt}
        image={post.featuredImage}
        url={`https://atlashomestays.com/blog/${post.slug}`}
        type="article"
      />
      <div className="max-w-4xl mx-auto space-y-6 bg-white p-6 md:p-10 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-2">
          <Link to="/blog" className="text-primary font-semibold">
            Back to Blog
          </Link>
          <p className="text-sm uppercase tracking-[0.18em] text-primary font-semibold">
            {post.category === "guest-guides" ? "Guest Guides" : "Hospitality Tech & AI"}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{post.title}</h1>
        </div>
        {post.featuredImage && (
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full h-72 object-cover rounded-xl"
            loading="lazy"
          />
        )}
        <p className="text-slate-700 leading-relaxed text-lg">{post.content}</p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-sm text-slate-600">
            For booking offers and property policies, explore our Apartments, Offers, and Policies pages.
          </p>
          <div className="flex gap-3 mt-3 flex-wrap">
            <Link to="/apartments" className="btn-chip">Apartments</Link>
            <Link to="/offers" className="btn-chip">Offers</Link>
            <Link to="/policies" className="btn-chip">Policies</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPostPage;
