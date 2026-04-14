/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Fraunces", "ui-serif", "Georgia", "serif"],
      },
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        glow: "rgb(var(--color-glow) / <alpha-value>)",
        neon: "rgb(var(--color-neon) / <alpha-value>)",
        mist: "rgb(var(--color-mist) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
      },
      boxShadow: {
        glow: "0 0 30px rgba(120, 204, 255, 0.35)",
        soft: "0 18px 40px rgba(15, 23, 42, 0.12)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        shimmer: "shimmer 10s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
