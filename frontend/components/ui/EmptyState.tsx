"use client";

import { ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "default" | "warning" | "success" | "info" | "purple";
};

const VARIANT_STYLES: Record<
  NonNullable<EmptyStateProps["variant"]>,
  { coreBg: string; haloColor: string; particleColor: string; ringColor: string; shadow: string }
> = {
  default: {
    coreBg: "linear-gradient(135deg, #21D0B3 0%, #1eb19a 50%, #15B09A 100%)",
    haloColor: "rgba(33,208,179,0.25)",
    particleColor: "linear-gradient(135deg, #34F3C6, #21D0B3)",
    ringColor: "rgba(33,208,179,0.3)",
    shadow: "0 20px 60px rgba(33,208,179,0.45)",
  },
  warning: {
    coreBg: "linear-gradient(135deg, #d4a017 0%, #f5c842 50%, #e3a808 100%)",
    haloColor: "rgba(212,160,23,0.25)",
    particleColor: "linear-gradient(135deg, #f5c842, #d4a017)",
    ringColor: "rgba(212,160,23,0.3)",
    shadow: "0 20px 60px rgba(212,160,23,0.45)",
  },
  success: {
    coreBg: "linear-gradient(135deg, #2e7d32 0%, #4caf50 50%, #2e7d32 100%)",
    haloColor: "rgba(46,125,50,0.25)",
    particleColor: "linear-gradient(135deg, #4caf50, #2e7d32)",
    ringColor: "rgba(46,125,50,0.3)",
    shadow: "0 20px 60px rgba(46,125,50,0.45)",
  },
  info: {
    coreBg: "linear-gradient(135deg, #1f4e8c 0%, #2d6aa8 50%, #1f4e8c 100%)",
    haloColor: "rgba(31,78,140,0.25)",
    particleColor: "linear-gradient(135deg, #2d6aa8, #1f4e8c)",
    ringColor: "rgba(31,78,140,0.3)",
    shadow: "0 20px 60px rgba(31,78,140,0.45)",
  },
  purple: {
    coreBg: "linear-gradient(135deg, #5e3aab 0%, #7c5ec4 50%, #5e3aab 100%)",
    haloColor: "rgba(94,58,171,0.25)",
    particleColor: "linear-gradient(135deg, #7c5ec4, #5e3aab)",
    ringColor: "rgba(94,58,171,0.3)",
    shadow: "0 20px 60px rgba(94,58,171,0.45)",
  },
};

export default function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
}: EmptyStateProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className="surface-premium mesh-bg p-14 text-center relative overflow-hidden anim-fade-up-soft"
      style={{
        minHeight: "420px",
        background: "linear-gradient(135deg, #ffffff 0%, #fafdfc 50%, #ffffff 100%)",
      }}
    >
      {/* Halo gigante */}
      <div className="ambient-orb anim-orb-slow"
        style={{
          width: "440px", height: "440px",
          top: "-120px", left: "50%", transform: "translateX(-50%)",
          background: `radial-gradient(circle, ${styles.haloColor} 0%, transparent 65%)`,
          opacity: 1,
        }} />

      {/* Particles */}
      <span className="particle" style={{
        top: "22%", left: "18%", animationDelay: "0s",
        background: styles.particleColor,
      }} />
      <span className="particle" style={{
        top: "30%", right: "22%", animationDelay: "1s",
        background: styles.particleColor,
      }} />
      <span className="particle" style={{
        top: "65%", left: "15%", animationDelay: "2s",
        background: styles.particleColor,
      }} />
      <span className="particle" style={{
        top: "70%", right: "18%", animationDelay: "3s",
        background: styles.particleColor,
      }} />

      <div className="relative z-10">
        {/* Hero icon con orbitas */}
        {icon && (
          <div className="hero-icon-wrap mb-5"
            style={{ width: "120px", height: "120px" }}>
            <div className="orbit-ring"
              style={{
                inset: "0",
                borderColor: styles.ringColor,
                animationDuration: "30s",
              }} />
            <div className="orbit-ring"
              style={{
                inset: "12px",
                borderColor: styles.ringColor,
                animationDuration: "20s",
                animationDirection: "reverse",
                opacity: 0.5,
              }} />
            <div className="pulse-ring"
              style={{
                inset: "8px",
                borderColor: styles.ringColor,
              }} />
            <div className="hero-icon-core"
              style={{
                inset: "26px",
                background: styles.coreBg,
                boxShadow: `${styles.shadow}, 0 8px 20px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.3)`,
                color: "#fff",
              }}>
              {icon}
            </div>
          </div>
        )}

        <h3 className="text-2xl font-extrabold mb-2 tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-sm max-w-md mx-auto leading-relaxed"
            style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
        {action && (
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
