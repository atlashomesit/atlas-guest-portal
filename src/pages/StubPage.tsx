import SEO from "../components/SEO";

interface StubPageProps {
  title: string;
  description: string;
  heading: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}

const StubPage = ({ title, description, heading, body, ctaHref, ctaLabel }: StubPageProps) => {
  return (
    <div className="px-4 md:px-10 lg:px-20 py-28 bg-gray-50 min-h-screen">
      <SEO title={title} description={description} />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <p className="uppercase tracking-[0.2em] text-primary font-semibold">Atlas Homestays</p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{heading}</h1>
          <p className="text-lg text-slate-600">{description}</p>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 md:p-8">
          <p className="text-slate-700 leading-relaxed">{body}</p>
        </div>
        {ctaHref && ctaLabel && (
          <a
            href={ctaHref}
            className="inline-flex w-full sm:w-auto justify-center items-center px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-md hover:shadow-lg transition"
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
};

export default StubPage;
