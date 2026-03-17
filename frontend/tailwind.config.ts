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
        ink:         "#0b1628",
        navy:        "#0b1628",
        "navy-light":"#0f1e35",
        gold:        "#c9a84c",
        "gold-light":"#e8c96a",
        ember:       "#f97316",
        mist:        "#f4f6f9",
        slate:       "#334155"
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
        glow: "0 0 40px rgba(201,168,76,0.2)",
        gold: "0 0 20px rgba(201,168,76,0.35)",
        soft: "0 20px 60px rgba(11,22,40,0.4)"
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
