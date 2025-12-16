interface LegalSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const LegalSearch = ({ value, onChange, placeholder }: LegalSearchProps) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-800" htmlFor="legal-search">
        Search
      </label>
      <input
        id="legal-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search policies or FAQs"}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus:border-primary focus:outline-none"
      />
    </div>
  );
};

export default LegalSearch;
