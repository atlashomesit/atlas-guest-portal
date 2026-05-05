/* eslint-disable atlas-brand/no-atlas-string-leak -- TODO Task 16: replace with per-tenant content */
import SEO from "../components/SEO";
import { getTenantContext } from "../tenant/tenantContext";

interface StubPageProps {
  title: string;
  description: string;
  heading: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}

const StubPage = ({ title, description, heading, body, ctaHref, ctaLabel }: StubPageProps) => {
  const brandName = getTenantContext()?.name ?? 'Atlas Homestays';
  return (
    <div className="px-4 md:px-10 lg:px-20 py-28 bg-bg-muted min-h-screen">
      <SEO title={title} description={description} />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <p className="uppercase tracking-[0.2em] text-primary font-semibold">{brandName}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary">{heading}</h1>
          <p className="text-lg text-text-muted">{description}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle shadow-level1 rounded-2xl p-6 md:p-8">
          <p className="text-text-muted leading-relaxed">{body}</p>
        </div>
        {ctaHref && ctaLabel && (
          <a
            href={ctaHref}
            className="inline-flex w-full sm:w-auto justify-center items-center px-5 py-3 rounded-xl bg-cta-primary text-[var(--text-contrast)] font-semibold shadow-level1 hover:shadow-level2 transition"
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
};

export default StubPage;
