import { useEffect, useMemo, useState } from "react";
import { FaqItem } from "../../content/faq";

interface FaqAccordionProps {
  items: FaqItem[];
  activeItemId?: string;
}

const FaqAccordion = ({ items, activeItemId }: FaqAccordionProps) => {
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setOpenItemId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    if (activeItemId && ids.includes(activeItemId)) {
      setOpenItemId(activeItemId);
      const element = document.getElementById(activeItemId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [activeItemId, ids]);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isOpen = openItemId === item.id;
        const triggerId = `${item.id}-trigger`;
        return (
          <div
            key={item.id}
            id={item.id}
            className="border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              aria-expanded={isOpen}
              aria-controls={`${item.id}-panel`}
              id={triggerId}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left text-slate-900 font-semibold"
            >
              <span>{item.question}</span>
              <span aria-hidden className="text-primary text-xl">
                {isOpen ? "–" : "+"}
              </span>
            </button>
            <div
              id={`${item.id}-panel`}
              role="region"
              aria-labelledby={triggerId}
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-4 text-slate-700 leading-relaxed">{item.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FaqAccordion;
