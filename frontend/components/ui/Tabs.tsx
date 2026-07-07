"use client";

import { ReactNode } from "react";

type Tab<T extends string> = {
  key: T;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
};

type TabsProps<T extends string> = {
  tabs: Tab<T>[];
  value: T;
  onChange: (key: T) => void;
};

export default function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: TabsProps<T>) {
  return (
    <div
      className="surface rounded-2xl p-1.5 inline-flex flex-wrap gap-1"
      role="tablist"
    >
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: active
                ? "linear-gradient(135deg, #21D0B3 0%, #1eb19a 100%)"
                : "transparent",
              color: active ? "#fff" : "var(--text-muted)",
              boxShadow: active ? "0 2px 8px rgba(33, 208, 179, 0.30)" : "none",
            }}
          >
            {t.icon && (
              <span className="flex-shrink-0" style={{ opacity: active ? 1 : 0.7 }}>
                {t.icon}
              </span>
            )}
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge !== null && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: active
                    ? "rgba(255,255,255,0.25)"
                    : "rgba(33, 208, 179, 0.12)",
                  color: active ? "#fff" : "#1eb19a",
                  minWidth: "18px",
                  textAlign: "center",
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
