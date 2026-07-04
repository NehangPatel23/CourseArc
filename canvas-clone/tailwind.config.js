/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        canvas: "0 1px 3px rgba(0,0,0,0.08)",
        "canvas-hover": "0 8px 24px rgba(0, 0, 0, 0.1)",
        "canvas-dark": "0 4px 24px rgba(0, 0, 0, 0.35)",
        "canvas-dark-hover": "0 12px 32px rgba(0, 0, 0, 0.45)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
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
        fadeOutUp: "fadeOutUp 0.15s ease-in forwards",
        shrinkFade: "shrinkFade 0.25s ease-in-out forwards",
        splashIn: "splashIn 0.4s ease-out forwards",
        splashOut: "splashOut 0.4s ease-in forwards",
        splashLogoIn: "splashLogoIn 0.6s ease-out forwards",
        splashTaglineIn: "splashTaglineIn 0.5s ease-out 0.3s forwards",
      },
      colors: {
        canvas: {
          blue: "#008EE2",
          blueDark: "#0079C2",
          blueLight: "#1DA1F2",
          blueTint: "#F2FAFF",
          grayDark: "#2D3B45",
          grayMedium: "#3A4C59",
          grayMuted: "#778690",
          grayLight: "#F7F8FA",
          surface: "#1A2229",
          surfaceRaised: "#2A3540",
          green: "#28A745",
          red: "#D6392C",
          border: "#E3E8EE",
        },
      },
      fontFamily: {
        lato: ['"Lato"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
