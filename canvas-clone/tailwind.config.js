/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      spacing: {
        15: "3.75rem",
      },
      boxShadow: {
        canvas: "0 1px 3px rgba(0,0,0,0.08)",
        "canvas-hover": "0 8px 24px rgba(0, 0, 0, 0.1)",
        "canvas-dark": "0 4px 24px rgba(0, 0, 0, 0.35)",
        "canvas-dark-hover": "0 12px 32px rgba(0, 0, 0, 0.45)",
        paper: "0 1px 0 rgba(28, 25, 22, 0.06)",
        lift: "0 18px 40px -24px rgba(28, 25, 22, 0.28)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        toastIn: {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        toastProgress: {
          "0%": { transform: "scaleX(1)" },
          "100%": { transform: "scaleX(0)" },
        },
        fadeOutUp: {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-4px)" },
        },
        shrinkFade: {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.95)" },
        },
        splashIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        splashOut: {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(1.02)" },
        },
        splashLogoIn: {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        splashTaglineIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeInUp: "fadeInUp 0.5s ease-out forwards",
        toastIn: "toastIn 0.28s ease-out forwards",
        toastProgress: "toastProgress 3.6s linear forwards",
        fadeOutUp: "fadeOutUp 0.15s ease-in forwards",
        shrinkFade: "shrinkFade 0.25s ease-in-out forwards",
        splashIn: "splashIn 0.4s ease-out forwards",
        splashOut: "splashOut 0.4s ease-in forwards",
        splashLogoIn: "splashLogoIn 0.6s ease-out forwards",
        splashTaglineIn: "splashTaglineIn 0.5s ease-out 0.3s forwards",
      },
      colors: {
        canvas: {
          blue: "rgb(var(--arc-copper) / <alpha-value>)",
          blueDark: "rgb(var(--arc-copper-dark) / <alpha-value>)",
          blueLight: "rgb(var(--arc-copper-light) / <alpha-value>)",
          blueTint: "rgb(var(--arc-copper-tint) / <alpha-value>)",
          grayDark: "rgb(var(--arc-ink) / <alpha-value>)",
          grayMedium: "rgb(var(--arc-ink-soft) / <alpha-value>)",
          grayMuted: "rgb(var(--arc-mute) / <alpha-value>)",
          grayLight: "rgb(var(--arc-paper) / <alpha-value>)",
          surface: "rgb(var(--arc-moss) / <alpha-value>)",
          surfaceRaised: "rgb(var(--arc-moss-raised) / <alpha-value>)",
          green: "rgb(var(--arc-sage) / <alpha-value>)",
          red: "rgb(var(--arc-brick) / <alpha-value>)",
          border: "rgb(var(--arc-line) / <alpha-value>)",
        },
        arc: {
          paper: "rgb(var(--arc-paper) / <alpha-value>)",
          ivory: "rgb(var(--arc-ivory) / <alpha-value>)",
          ink: "rgb(var(--arc-ink) / <alpha-value>)",
          copper: "rgb(var(--arc-copper) / <alpha-value>)",
          "copper-dark": "rgb(var(--arc-copper-dark) / <alpha-value>)",
          moss: "rgb(var(--arc-moss) / <alpha-value>)",
          "moss-raised": "rgb(var(--arc-moss-raised) / <alpha-value>)",
          gold: "rgb(var(--arc-gold) / <alpha-value>)",
          sage: "rgb(var(--arc-sage) / <alpha-value>)",
          brick: "rgb(var(--arc-brick) / <alpha-value>)",
          line: "rgb(var(--arc-line) / <alpha-value>)",
          mute: "rgb(var(--arc-mute) / <alpha-value>)",
          cream: "rgb(var(--arc-cream) / <alpha-value>)",
        },
      },
      fontFamily: {
        lato: ['"Sora"', "system-ui", "sans-serif"],
        sans: ['"Sora"', "system-ui", "sans-serif"],
        display: ['"Fraunces"', "Georgia", "serif"],
        sora: ['"Sora"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
