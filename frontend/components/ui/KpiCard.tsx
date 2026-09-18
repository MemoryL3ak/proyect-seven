"use client";

import { ReactNode, useEffect, useState } from "react";
import { ACCENT, STATE, SURFACE } from "@/lib/design";

type KpiCardProps = {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
  accent?: "blue" | "amber" | "green" | "red" | "purple" | "neutral";
  trend?: { value: number; positive?: boolean };
};

const ACCENT_STYLES: Record<
  NonNullable<KpiCardProps["accent"]>,
  { iconBg: string; iconColor: string; accentBorder: string; valueColor: string; glowColor: string }
> = {
  blue: {
    iconBg: "linear-gradient(135deg, #eef4fb 0%, #d6e4f5 100%)",
    iconColor: STATE.infoText,
    accentBorder: STATE.infoText,
    valueColor: "#0e2a47",
    glowColor: "rgba(31,78,140,0.15)",
  },
  amber: {
    iconBg: `linear-gradient(135deg, ${STATE.warningSoft} 0%, #fce6a8 100%)`,
    iconColor: STATE.warningText,
    accentBorder: STATE.warningText,
    valueColor: STATE.warningText,
    glowColor: "rgba(199,140,0,0.15)",
  },
  green: {
    iconBg: `linear-gradient(135deg, ${STATE.successSoft} 0%, #c9ead2 100%)`,
    iconColor: STATE.successText,
    accentBorder: STATE.successText,
    valueColor: "#1e5125",
    glowColor: "rgba(46,125,50,0.15)",
  },
  red: {
    iconBg: `linear-gradient(135deg, ${STATE.dangerSoft} 0%, #f8c0c0 100%)`,
    iconColor: STATE.dangerText,
    accentBorder: STATE.dangerText,
    valueColor: "#7a1313",
    glowColor: "rgba(179,35,27,0.15)",
  },
  purple: {
    iconBg: "linear-gradient(135deg, #f4f0fb 0%, #e3d8f4 100%)",
    iconColor: ACCENT.violet,
    accentBorder: ACCENT.violet,
    valueColor: "#3d2375",
    glowColor: "rgba(94,58,171,0.15)",
  },
  neutral: {
    iconBg: `linear-gradient(135deg, ${SURFACE.borderMuted} 0%, #dde2eb 100%)`,
    iconColor: SURFACE.textMuted,
    accentBorder: SURFACE.textMuted,
    valueColor: "#1a1a1a",
    glowColor: "rgba(94,107,122,0.12)",
  },
};

export default function KpiCard({
  label,
  value,
  detail,
  icon,
  accent = "neutral",
  trend,
}: KpiCardProps) {
  const styles = ACCENT_STYLES[accent];
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    setPulseKey((k) => k + 1);
  }, [value]);

  return (
    <div
      className="surface-premium p-4 anim-fade-up-soft"
      style={{ borderLeft: `3px solid ${styles.accentBorder}` }}
    >
      <div className="shimmer-top" />

      {/* Ambient glow del color del accent */}
      <div className="ambient-orb"
        style={{
          width: "120px", height: "120px",
          top: "-30px", right: "-30px",
          background: `radial-gradient(circle, ${styles.glowColor} 0%, transparent 65%)`,
        }} />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            {label}
          </p>
          {icon && (
            <div
              className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center icon-bounce"
              style={{
                background: styles.iconBg,
                color: styles.iconColor,
                boxShadow: `0 2px 8px ${styles.glowColor}`,
              }}
            >
              {icon}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <p
            key={pulseKey}
            className="text-3xl font-bold leading-none anim-count-pulse"
            style={{ color: styles.valueColor }}
          >
            {value}
          </p>
          {trend && (
            <span
              className="text-xs font-semibold"
              style={{ color: trend.positive ? STATE.successText : STATE.dangerText }}
            >
              {trend.positive ? "▲" : "▼"} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        {detail && (
          <p
            className="text-[11px] mt-2 leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
