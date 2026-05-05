interface LegalSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const LegalSearch = ({ value, onChange, placeholder }: LegalSearchProps) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-text-primary" htmlFor="legal-search">
        Search
      </label>
      <input
        id="legal-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search policies or FAQs"}
        className="w-full rounded-xl bg-transparent px-4 py-3 shadow-level1 focus:border-cta-primary focus:outline-none text-text-primary"
      />
    </div>
  );
};

export default LegalSearch;
