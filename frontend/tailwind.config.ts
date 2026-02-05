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
        ink: "#0f172a",
        ember: "#f97316",
        lagoon: "#0ea5a0",
        sunrise: "#fde68a",
        shell: "#fff7ed",
        slate: "#334155"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.12)",
        glow: "0 0 40px rgba(14, 165, 160, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
