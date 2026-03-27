import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["\"Helvetica Neue\"", "Helvetica", "Arial", "sans-serif"],
        display: ["\"Helvetica Neue\"", "Helvetica", "Arial", "sans-serif"]
      },
      colors: {
        bg:          "#f0f3fa",
        surface:     "#ffffff",
        elevated:    "#f1f5f9",
        brand:       "#21D0B3",
        "brand-dim": "rgba(33,208,179,0.1)",
        gold:        "#34F3C6",
        "gold-light":"#6AF5DC",
        border:      "#e2e8f0",
        "text-main": "#0f172a",
        "text-muted":"#64748b",
        success:     "#16a34a",
        warning:     "#d97706",
        danger:      "#dc2626",
        info:        "#1FCDFF"
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        glow: "0 0 16px rgba(52,243,198,0.2)",
        gold: "0 4px 10px rgba(52,243,198,0.3)",
        soft: "0 4px 16px rgba(15,23,42,0.08)"
      },
      animation: {
        "fade-up":  "fadeUp 0.3s ease both",
        "fade-in":  "fadeIn 0.25s ease both",
        "scale-in": "scaleIn 0.2s ease both",
        "shimmer":  "shimmer 1.6s infinite linear",
        "pulse-dot":"pulseDot 2s ease-in-out infinite"
      },
      keyframes: {
        fadeUp:   { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fadeIn:   { from: { opacity: "0" }, to: { opacity: "1" } },
        scaleIn:  { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "scale(1)" } },
        shimmer:  { "0%": { backgroundPosition: "-600px 0" }, "100%": { backgroundPosition: "600px 0" } },
        pulseDot: { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: "0.5", transform: "scale(0.85)" } }
      },
      backdropBlur: { xs: "4px" }
    }
  },
  plugins: []
};

export default config;
