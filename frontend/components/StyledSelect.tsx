"use client";

import React, { useEffect, useRef, useState } from "react";
import { BRAND, SURFACE } from "@/lib/design";
import { ChevronDownIcon, CheckIcon } from "@/components/ui/Icons";
import { altoEstimadoDeLista, direccionDeLista, filtrarOpciones, type DireccionLista } from "@/lib/desplegable";

type Option = { value: string; label: string; disabled?: boolean };

type Props = {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
  disabled?: boolean;
  wrapperStyle?: React.CSSProperties;
  wrapperClassName?: string;
  style?: React.CSSProperties;
  /**
   * Con una caja de búsqueda arriba de la lista (12-10-2026: la lista de
   * patentes del Monitoreo no dejaba buscar). Al abrir, el foco va a la caja;
   * Enter elige la primera coincidencia.
   */
  buscable?: boolean;
  placeholderBusqueda?: string;
  /** Valores que se muestran aunque no calcen con lo buscado ("Otra patente…"). */
  siempreVisibles?: string[];
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
  buscable = false,
  placeholderBusqueda = "Buscar…",
  siempreVisibles = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  // Hacia dónde se abre la lista: hacia arriba cuando abajo no cabe (barra
  // flotante al pie de Viajes, 09-10-2026).
  const [direccion, setDireccion] = useState<DireccionLista>("abajo");
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = parseOptions(children);
  const selected = options.find((o) => o.value === value);
  const visibles = buscable ? filtrarOpciones(options, busqueda, siempreVisibles) : options;

  const alternar = () => {
    if (disabled) return;
    if (!open && ref.current && typeof window !== "undefined") {
      const r = ref.current.getBoundingClientRect();
      setDireccion(direccionDeLista(window.innerHeight - r.bottom, r.top, altoEstimadoDeLista(options.length + (buscable ? 1 : 0))));
    }
    setBusqueda("");
    setOpen((v) => !v);
  };

  // Al abrir una lista buscable, se escribe de inmediato.
  useEffect(() => {
    if (open && buscable) inputRef.current?.focus();
  }, [open, buscable]);

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
      alternar();
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
  const arriba = open && direccion === "arriba";

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
        onMouseDown={(e) => { e.preventDefault(); alternar(); }}
        onKeyDown={handleKeyDown}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 12px",
          borderRadius: open ? (arriba ? "0 0 10px 10px" : "10px 10px 0 0") : "10px",
          // Sólo longhands: mezclar `border` con `borderBottom` hace que React
          // avise "Updating a style property during rerender" al abrir/cerrar.
          borderTop: open && arriba ? `1px solid ${SURFACE.border}` : `1px solid ${borderColor}`,
          borderRight: `1px solid ${borderColor}`,
          borderLeft: `1px solid ${borderColor}`,
          borderBottom: open && !arriba ? `1px solid ${SURFACE.border}` : `1px solid ${borderColor}`,
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
            ...(arriba ? { bottom: "100%" } : { top: "100%" }),
            left: 0,
            right: 0,
            zIndex: 200,
            background: SURFACE.card,
            border: `1px solid ${BRAND.teal}`,
            ...(arriba ? { borderBottom: "none" } : { borderTop: "none" }),
            borderRadius: arriba ? "10px 10px 0 0" : "0 0 10px 10px",
            boxShadow: arriba ? "0 -8px 24px rgba(15,23,42,0.12)" : "0 8px 24px rgba(15,23,42,0.12)",
            // 200px cortaba la lista en la sexta fila: los tipos de cliente
            // quedaban ocultos tras el scroll y parecian no existir.
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {buscable && (
            <div style={{ position: "sticky", top: 0, zIndex: 1, padding: "6px 8px", background: SURFACE.card, borderBottom: `1px solid ${SURFACE.borderMuted}` }}>
              <input
                ref={inputRef}
                type="text"
                value={busqueda}
                placeholder={placeholderBusqueda}
                aria-label={placeholderBusqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const primera = visibles.find((o) => !o.disabled && !siempreVisibles.includes(o.value)) ?? visibles.find((o) => !o.disabled);
                    if (primera) pick(primera.value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "6px 10px",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  borderRadius: "8px",
                  border: `1px solid ${SURFACE.border}`,
                  background: SURFACE.bg,
                  color: SURFACE.text,
                  outline: "none",
                }}
              />
            </div>
          )}
          {buscable && visibles.length === 0 && (
            <div style={{ padding: "8px 12px", fontSize: "12.5px", color: SURFACE.textFaint }}>Sin resultados</div>
          )}
          {visibles.map((opt, i) => {
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
                  borderBottom: i < visibles.length - 1 ? `1px solid ${SURFACE.borderMuted}` : "none",
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
