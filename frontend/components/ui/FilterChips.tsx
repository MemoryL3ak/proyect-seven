"use client";

type Option = {
  value: string;
  label: string;
  count?: number;
};

type FilterChipsProps = {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  allLabel?: string;
};

export default function FilterChips({
  options,
  value,
  onChange,
  allLabel = "Todos",
}: FilterChipsProps) {
  const fullOptions: Option[] = [{ value: "", label: allLabel }, ...options];
  return (
    <div className="flex flex-wrap gap-2">
      {fullOptions.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-all"
            style={{
              background: active
                ? "linear-gradient(135deg, #21D0B3 0%, #1eb19a 100%)"
                : "#eef1f6",
              color: active ? "#fff" : "#475569",
              boxShadow: active ? "0 1px 4px rgba(33, 208, 179, 0.30)" : "none",
            }}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className="ml-1.5 text-[10px] font-bold opacity-80"
                style={{ marginLeft: "6px" }}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
