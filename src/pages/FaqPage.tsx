import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import FaqAccordion from "../components/Faq/FaqAccordion";
import SEO from "../components/SEO";
import { faqSections } from "../content/faq";
import { useScrollToHash } from "../hooks/useScrollToHash";
import { buildWaLink, defaultPrefill } from "../utils/whatsapp";

const FaqPage = () => {
  useScrollToHash();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const activeHash = useMemo(() => location.hash.replace("#", ""), [location.hash]);
  const contextLabel = activeHash ? activeHash.replace(/-/g, " ") : undefined;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedSearch) return faqSections;

    return faqSections
      .map((section) => {
        const filteredItems = section.items.filter((item) => {
          const matchQuestion = item.question.toLowerCase().includes(normalizedSearch);
          const matchTag = (item.tags || []).some((tag) => tag.toLowerCase().includes(normalizedSearch));
          return matchQuestion || matchTag;
        });
        return { ...section, items: filteredItems };
      })
      .filter((section) => section.items.length > 0);
  }, [normalizedSearch]);

  const whatsappPhone = import.meta.env.VITE_WHATSAPP_PHONE_E164 || "+917032493290";

  const whatsappLink = useMemo(() => {
    const href = typeof window !== "undefined" ? window.location.href : "";
    const prefill = defaultPrefill({ href, context: contextLabel });
    return buildWaLink({ phoneE164: whatsappPhone, text: prefill });
  }, [contextLabel, whatsappPhone]);

  const hasResults = filteredSections.some((section) => section.items.length > 0);

  return (
    <div className="bg-gray-50 min-h-screen py-28 px-4 md:px-10 lg:px-20">
      <SEO
        title="Frequently Asked Questions | Atlas Homestays"
        description="Quick answers about booking, check-in, policies, amenities, and long stays at Atlas Homestays."
      />

      <div className="max-w-5xl mx-auto space-y-12">
        <header className="space-y-4 text-center md:text-left">
          <p className="uppercase tracking-[0.25em] text-primary font-semibold text-xs">Atlas Homestays</p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Frequently Asked Questions</h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            Quick answers about booking, check-in, policies, and amenities.
          </p>
          <div className="mt-4 max-w-xl mx-auto md:mx-0">
            <label className="block text-sm font-semibold text-slate-800 mb-1" htmlFor="faq-search">
              Search FAQs
            </label>
            <input
              id="faq-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search questions or keywords"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus:border-primary focus:outline-none"
            />
          </div>
        </header>

        <div className="space-y-12">
          {filteredSections.map((section) => (
            <section key={section.id} id={section.id} className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">{section.title}</h2>
                <p className="text-slate-700">{section.description}</p>
              </div>
              {section.items.length > 0 ? (
                <FaqAccordion items={section.items} activeItemId={activeHash} />
              ) : (
                <p className="text-sm text-slate-500">No questions match your search in this category.</p>
              )}
            </section>
          ))}

          {!hasResults && (
            <div className="text-center text-slate-600 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              No questions match your search yet. Try a different keyword or scroll for more topics.
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-primary/90 to-primary text-white rounded-2xl p-8 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Still have questions?</h3>
              <p className="text-white/90 max-w-xl">
                Chat with us on WhatsApp and we&apos;ll help with booking, policies, or anything else you need.
              </p>
            </div>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-primary font-semibold rounded-xl shadow-md hover:shadow-lg transition"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaqPage;
