import { useState } from "react";

interface GuestGuidebookProps {
  appliances?: string | null;
  wifiTroubleshooting?: string | null;
  trashParking?: string | null;
  checkoutChecklist?: string | null;
  foodThingsToDo?: string | null;
}

/**
 * TASK-4510: Guest-facing digital guidebook — host-authored content shown
 * on booking confirmation page and stay pages. Sections without content
 * are hidden (no empty panels).
 */
export default function GuestGuidebook({
  appliances,
  wifiTroubleshooting,
  trashParking,
  checkoutChecklist,
  foodThingsToDo,
}: GuestGuidebookProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Collect non-empty sections
  const sections = [
    { id: "appliances", title: "Appliances & how-tos", emoji: "🔧", content: appliances },
    { id: "wifi-help", title: "Wi-Fi troubleshooting", emoji: "📶", content: wifiTroubleshooting },
    { id: "trash", title: "Trash & parking", emoji: "🅿️", content: trashParking },
    { id: "checkout", title: "Checkout process", emoji: "✓", content: checkoutChecklist },
    { id: "food", title: "Local recommendations", emoji: "🍽️", content: foodThingsToDo },
  ].filter((s) => s.content?.trim());

  // Hide entire guidebook if no sections
  if (sections.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5" data-testid="guest-guidebook">
      <h2 className="text-sm font-semibold text-text-primary mb-3">📚 Guidebook</h2>

      {/* Accordion-style sections */}
      <div className="space-y-2">
        {sections.map((section) => (
          <div
            key={section.id}
            className="border border-border-subtle rounded-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedSection(
                  expandedSection === section.id ? null : section.id
                )
              }
              className="w-full px-4 py-3 text-left font-medium text-sm text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-between"
              data-testid={`guidebook-section-${section.id}`}
            >
              <span>
                {section.emoji} {section.title}
              </span>
              <span
                className={`text-xs text-text-muted transition-transform ${
                  expandedSection === section.id ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {expandedSection === section.id && (
              <div className="px-4 py-3 bg-bg-hover border-t border-border-subtle">
                <p className="text-sm text-text-primary whitespace-pre-wrap">
                  {section.content}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
