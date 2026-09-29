import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f6f7",
          100: "#ececee",
          200: "#d5d6db",
          300: "#b0b2bc",
          400: "#848794",
          500: "#666a79",
          600: "#515361",
          700: "#43444f",
          800: "#3a3b43",
          850: "#2c2d34",
          900: "#1d1e24",
          925: "#17181d",
          950: "#101116",
          975: "#0b0c10",
        },
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "Space Grotesk",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        manga: ["Comic Sans MS", "Chalkboard SE", "Comic Neue", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.5)",
        pop: "0 12px 40px -8px rgba(0,0,0,0.7)",
        glow: "0 0 24px -4px var(--accent-soft)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        spinSlow: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
        fadeUp: "fadeUp 0.3s ease-out both",
        popIn: "popIn 0.18s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
