"use client";

import React, { useEffect, useRef, useState } from "react";
import { BRAND, SURFACE } from "@/lib/design";
import { ChevronDownIcon, CheckIcon } from "@/components/ui/Icons";

type Option = { value: string; label: string; disabled?: boolean };

type Props = {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
  disabled?: boolean;
  wrapperStyle?: React.CSSProperties;
  wrapperClassName?: string;
  style?: React.CSSProperties;
};

function parseOptions(children: React.ReactNode): Option[] {
  const opts: Option[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === "option") {
      const p = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
      opts.push({ value: String(p.value ?? ""), label: String(p.children ?? ""), disabled: p.disabled });
    }
  });
  return opts;
}

export default function StyledSelect({
  value = "",
  onChange,
  children,
  disabled,
  wrapperStyle,
  wrapperClassName,
  style,
}: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const options = parseOptions(children);
  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === value);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((v) => !v);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = options.slice(idx + 1).find((o) => !o.disabled);
      if (next) pick(next.value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = [...options].slice(0, idx).reverse().find((o) => !o.disabled);
      if (prev) pick(prev.value);
    }
  };

  const pick = (v: string) => {
    if (onChange) {
      onChange({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>);
    }
    setOpen(false);
  };

  const active = open || focused;
  const borderColor = active ? BRAND.teal : SURFACE.border;
  const shadow = open ? "0 0 0 3px rgba(33,208,179,0.12)" : "none";

  return (
    <div
      ref={ref}
      className={wrapperClassName}
      style={{ position: "relative", width: "100%", ...wrapperStyle }}
    >
      {/* Trigger */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); }}
        onMouseDown={(e) => { e.preventDefault(); if (!disabled) setOpen((v) => !v); }}
        onKeyDown={handleKeyDown}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 12px",
          borderRadius: open ? "10px 10px 0 0" : "10px",
          border: `1px solid ${borderColor}`,
          borderBottom: open ? `1px solid #e2e8f0` : `1px solid ${borderColor}`,
          background: SURFACE.bg,
          fontSize: "13px",
          lineHeight: "1.5",
          color: selected?.value !== "" ? SURFACE.text : SURFACE.textFaint,
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          boxShadow: shadow,
          userSelect: "none",
          opacity: disabled ? 0.5 : 1,
          ...style,
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? ""}
        </span>
        <ChevronDownIcon size={14} color={active ? BRAND.teal : SURFACE.textFaint} strokeWidth={2.5} style={{ flexShrink: 0, marginLeft: "8px", transition: "stroke 150ms ease, transform 150ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </div>

      {/* Dropdown list */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 200,
            background: SURFACE.card,
            border: `1px solid ${BRAND.teal}`,
            borderTop: "none",
            borderRadius: "0 0 10px 10px",
            boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value || `__opt_${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => { e.preventDefault(); if (!opt.disabled) pick(opt.value); }}
                style={{
                  padding: "7px 12px",
                  fontSize: "13px",
                  cursor: opt.disabled ? "default" : "pointer",
                  color: isSelected ? BRAND.teal : opt.disabled ? SURFACE.borderStrong : SURFACE.text,
                  fontWeight: isSelected ? 700 : 400,
                  background: isSelected ? "rgba(33,208,179,0.06)" : "transparent",
                  borderBottom: i < options.length - 1 ? "1px solid #f1f5f9" : "none",
                  transition: "background 100ms ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => { if (!isSelected && !opt.disabled) (e.currentTarget as HTMLElement).style.background = SURFACE.bg; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isSelected ? "rgba(33,208,179,0.06)" : "transparent"; }}
              >
                {opt.label}
                {isSelected && (
                  <CheckIcon size={14} color={BRAND.teal} strokeWidth={2.5} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
