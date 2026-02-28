import lineClamp from "@tailwindcss/line-clamp";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        canvas: "0 1px 3px rgba(0,0,0,0.08)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
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
      },
      animation: {
        fadeInUp: "fadeInUp 0.15s ease-out forwards",
        fadeOutUp: "fadeOutUp 0.15s ease-in forwards",
        shrinkFade: "shrinkFade 0.25s ease-in-out forwards",
      },
      colors: {
        canvas: {
          blue: "#008EE2",
          blueLight: "#1DA1F2",
          grayDark: "#2D3B45",
          grayMedium: "#3A4C59",
          grayLight: "#F7F8FA",
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
  plugins: [lineClamp],
};
