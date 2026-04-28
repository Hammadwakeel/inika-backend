type AxiomInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
};

export default function AxiomInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required = false,
  disabled = false,
}: AxiomInputProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-black">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        className="w-full border border-black bg-white px-3 py-3 text-sm font-bold tracking-[0.08em] text-black outline-none transition-colors placeholder:text-zinc-400 focus:border-black disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}
