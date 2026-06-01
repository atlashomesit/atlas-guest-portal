import React, { useState } from "react";
import "./ui.css";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  defaultTab = items[0]?.id,
  onChange,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  return (
    <div className="rb-tabs">
      <div className="rb-tabs__list" role="tablist">
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={activeTab === item.id}
            aria-controls={`panel-${item.id}`}
            disabled={item.disabled}
            className={`rb-tabs__trigger ${
              activeTab === item.id ? "rb-tabs__trigger--active" : ""
            } ${item.disabled ? "rb-tabs__trigger--disabled" : ""}`}
            onClick={() => !item.disabled && handleTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`panel-${item.id}`}
          aria-labelledby={item.id}
          className={`rb-tabs__content ${
            activeTab === item.id ? "" : "rb-tabs__content--hidden"
          }`}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
};

export default Tabs;
