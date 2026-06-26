import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0F",
        "bg-elev": "#12121A",
        border: "rgba(255,255,255,0.08)",
        text: "#EDEDF2",
        "text-muted": "#9A9AB0",
        accent: "#6C5CE7",
        "accent-2": "#00D2FF",
        success: "#2ECC71",
        danger: "#FF5C5C",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-space)", "Space Grotesk", "Inter", "sans-serif"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #6C5CE7, #00D2FF)",
      },
      boxShadow: {
        glow: "0 0 40px rgba(108,92,231,0.35)",
        "glow-cyan": "0 0 40px rgba(0,210,255,0.25)",
      },
      keyframes: {
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
      animation: {
        "gradient-pan": "gradient-pan 12s ease infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
