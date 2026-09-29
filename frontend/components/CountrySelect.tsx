"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon, SearchIcon } from "@/components/ui/Icons";
import { PAISES as COUNTRIES } from "@/lib/paises";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function CountrySelect({ value, onChange, placeholder = "— Seleccionar —" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = COUNTRIES.find(c => c.value === value);
  const filtered = search.trim()
    ? COUNTRIES.filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.value.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Scroll selected item into view when opening
  useEffect(() => {
    if (!open || !value || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-value="${value}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, value]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <style>{`
        @keyframes cs-in { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }
        .cs-item:hover { background: var(--elevated) !important; }
        .cs-item-active { background: rgba(33,208,179,0.1) !important; color: #21D0B3 !important; font-weight: 600 !important; }
        .cs-list::-webkit-scrollbar { width: 4px; }
        .cs-list::-webkit-scrollbar-track { background: transparent; }
        .cs-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
        .cs-trigger { transition: border-color 120ms ease, box-shadow 120ms ease; outline: none; }
        .cs-trigger:hover { border-color: var(--brand-light) !important; }
        .cs-trigger:focus { outline: none; }
      `}</style>

      {/* Trigger */}
      <button
        type="button"
        className="input cs-trigger"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          cursor: "pointer",
          color: selected ? "var(--text)" : "var(--text-faint)",
          font: "inherit",
          outline: "none",
          textAlign: "left",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selected ? selected.label : placeholder}
        </span>
        {selected && (
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", fontFamily: "monospace", flexShrink: 0 }}>
            {selected.value}
          </span>
        )}
        <ChevronDownIcon size={13} strokeWidth={2.5} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms ease", color: "var(--text-faint)" }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0, right: 0,
          zIndex: 1000,
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
          overflow: "hidden",
          animation: "cs-in 0.15s cubic-bezier(0.16,1,0.3,1) both",
        }}>
          {/* Search */}
          <div style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ position: "relative" }}>
              <SearchIcon size={13} strokeWidth={2.5} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }} />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar país…"
                style={{
                  width: "100%",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "8px",
                  padding: "6px 10px 6px 28px",
                  fontSize: "13px",
                  background: "var(--elevated)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* List */}
          <div ref={listRef} className="cs-list" style={{ maxHeight: "220px", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "14px 16px", fontSize: "13px", color: "var(--text-faint)", textAlign: "center" }}>
                Sin resultados
              </div>
            ) : filtered.map(c => (
              <button
                key={c.value}
                data-value={c.value}
                type="button"
                className={`cs-item${c.value === value ? " cs-item-active" : ""}`}
                onClick={() => { onChange(c.value); setOpen(false); }}
                style={{
                  width: "100%",
                  padding: "8px 14px",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "13px",
                  color: "var(--text)",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", minWidth: "32px", fontFamily: "monospace", letterSpacing: "0.02em" }}>
                  {c.value}
                </span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
