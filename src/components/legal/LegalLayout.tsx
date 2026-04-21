import { NavLink } from "react-router-dom";
import { ReactNode } from "react";

const tabs = [
  { label: "Policies", to: "/policies" },
  { label: "FAQs", to: "/faq" },
  { label: "Terms", to: "/terms" },
  { label: "Privacy", to: "/privacy" },
];

interface LegalLayoutProps {
  current: "policies" | "faq" | "terms" | "privacy";
  title: string;
  description: string;
  lastUpdated?: string;
  children: ReactNode;
}

const LegalLayout = ({ current, title, description, lastUpdated, children }: LegalLayoutProps) => {
  return (
    <div className="bg-bg-muted min-h-screen py-24 px-4 md:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="bg-bg-surface shadow-level1 rounded-2xl p-6 md:p-8 border border-border-subtle space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold text-text-primary">{title}</h1>
              <p className="text-lg text-text-muted max-w-3xl">{description}</p>
              {lastUpdated && <p className="text-sm text-text-muted">{lastUpdated}</p>}
            </div>
            <div className="self-start">
              <nav className="inline-flex rounded-full bg-bg-muted p-1" aria-label="Legal tabs">
                {tabs.map((tab) => (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    className={({ isActive }) =>
                      `px-4 py-2 text-sm font-semibold rounded-full transition ${
                        isActive || current.toLowerCase() === tab.label.toLowerCase()
                          ? "bg-bg-surface text-primary shadow-level1"
                          : "text-text-muted hover:text-primary"
                      }`
                    }
                  >
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
};

export default LegalLayout;
