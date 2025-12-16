import { NavLink } from "react-router-dom";
import { ReactNode } from "react";

const tabs = [
  { label: "Policies", to: "/policies" },
  { label: "FAQs", to: "/faq" },
  { label: "Terms", to: "/terms" },
];

interface LegalLayoutProps {
  current: "policies" | "faq" | "terms";
  title: string;
  description: string;
  lastUpdated?: string;
  children: ReactNode;
}

const LegalLayout = ({ current, title, description, lastUpdated, children }: LegalLayoutProps) => {
  return (
    <div className="bg-gray-50 min-h-screen py-24 px-4 md:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="bg-white shadow-sm rounded-2xl p-6 md:p-8 border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2">
              <p className="uppercase tracking-[0.2em] text-primary font-semibold text-xs">Atlas Guest Portal</p>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{title}</h1>
              <p className="text-lg text-slate-700 max-w-3xl">{description}</p>
              {lastUpdated && <p className="text-sm text-slate-500">{lastUpdated}</p>}
            </div>
            <div className="self-start">
              <nav className="inline-flex rounded-full bg-slate-100 p-1" aria-label="Legal tabs">
                {tabs.map((tab) => (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    className={({ isActive }) =>
                      `px-4 py-2 text-sm font-semibold rounded-full transition ${
                        isActive || current.toLowerCase() === tab.label.toLowerCase()
                          ? "bg-white text-primary shadow"
                          : "text-slate-700 hover:text-primary"
                      }`
                    }
                  >
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-slate-800">Which page should I read?</p>
            <ul className="list-disc pl-5 text-slate-700 space-y-1">
              <li>Policies for practical rules, schedules, and what to expect day-to-day.</li>
              <li>FAQs for quick answers and links to the relevant policy or terms.</li>
              <li>Terms for the binding legal contract and definitive language.</li>
            </ul>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
};

export default LegalLayout;
