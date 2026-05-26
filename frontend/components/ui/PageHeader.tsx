"use client";

import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  action?: ReactNode;
  meta?: ReactNode;
};

type PageHeaderExtraProps = { accentStrip?: "teal" | "gold" | "none" };

export default function PageHeader({
  title,
  description,
  icon,
  iconBg = "linear-gradient(135deg, #21D0B3 0%, #1eb19a 100%)",
  iconColor = "#fff",
  action,
  meta,
  accentStrip = "teal",
}: PageHeaderProps & PageHeaderExtraProps) {
  const stripClass = accentStrip === "gold"
    ? "accent-strip-gold"
    : accentStrip === "teal"
    ? "accent-strip-top"
    : "";

  const orbColor = accentStrip === "gold"
    ? "rgba(212,160,23,0.22)"
    : "rgba(33,208,179,0.20)";

  return (
    <section
      className={`surface-premium p-5 anim-fade-up-soft relative ${stripClass}`}
      style={{
        background: "linear-gradient(135deg, #ffffff 0%, #f8fffe 100%)",
        paddingTop: accentStrip === "none" ? undefined : "1.5rem",
      }}
    >
      {/* Orb decorativo más visible */}
      <div className="ambient-orb anim-orb-slow"
        style={{
          width: "260px", height: "260px",
          top: "-80px", right: "-60px",
          background: `radial-gradient(circle, ${orbColor} 0%, transparent 65%)`,
          opacity: 0.7,
        }} />
      <div className="ambient-orb"
        style={{
          width: "180px", height: "180px",
          bottom: "-60px", left: "20%",
          background: "radial-gradient(circle, rgba(31,205,255,0.10) 0%, transparent 65%)",
          opacity: 0.6,
        }} />

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {icon && (
            <div
              className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center icon-bounce anim-scale-pop relative"
              style={{
                background: iconBg,
                color: iconColor,
                boxShadow: accentStrip === "gold"
                  ? "0 10px 28px rgba(212,160,23,0.45), 0 4px 8px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.3)"
                  : "0 10px 28px rgba(33,208,179,0.40), 0 4px 8px rgba(0,0,0,0.12), inset 0 2px 4px rgba(255,255,255,0.3)",
              }}
            >
              {/* Ring decorativo */}
              <div className="absolute inset-0 rounded-2xl"
                style={{
                  border: `1px solid ${accentStrip === "gold" ? "rgba(245,200,66,0.4)" : "rgba(52,243,198,0.4)"}`,
                  transform: "scale(1.15)",
                }} />
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight mb-1 tracking-tight">
              {title}
            </h1>
            {description && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-muted)", maxWidth: "60ch" }}
              >
                {description}
              </p>
            )}
            {meta && <div className="mt-3">{meta}</div>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </section>
  );
}
