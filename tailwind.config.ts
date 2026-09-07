import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#000000",
          50: "#F2F2F2",
          100: "#D9D9D9",
          200: "#B3B3B3",
          300: "#848484",
          400: "#4D4D4D",
          500: "#000000",
          600: "#000000",
          700: "#000000",
          800: "#000000",
          900: "#000000",
        },
        gold: {
          DEFAULT: "#0183FF",
          50: "#E6F2FF",
          100: "#CCE6FF",
          200: "#99CCFF",
          300: "#01DCFE",
          400: "#01BCFE",
          500: "#0183FF",
          600: "#0025FF",
        },
        marca: {
          cian: "#01DCFE",
          celeste: "#01BCFE",
          azul: "#0183FF",
          ultra: "#0025FF",
          gris: "#848484",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Geist", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
