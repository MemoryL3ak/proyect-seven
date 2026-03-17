import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-sans)"]
      },
      colors: {
        bg:          "#0d1117",
        surface:     "#161b22",
        elevated:    "#21262d",
        sidebar:     "#010409",
        gold:        "#d4a843",
        "gold-light":"#e8c96a",
        border:      "#30363d",
        "text-main": "#e6edf3",
        "text-muted":"#8b949e",
        success:     "#3fb950",
        warning:     "#d29922",
        danger:      "#f85149",
        info:        "#58a6ff"
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)",
        glow: "0 0 20px rgba(212,168,67,0.25)",
        gold: "0 0 12px rgba(212,168,67,0.3)",
        soft: "0 8px 24px rgba(0,0,0,0.4)"
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
