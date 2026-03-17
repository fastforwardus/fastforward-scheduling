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
          DEFAULT: "#27295C",
          50: "#EEEEF7",
          100: "#CDCEE9",
          200: "#9B9ED3",
          300: "#696DBD",
          400: "#373CA7",
          500: "#27295C",
          600: "#1F2149",
          700: "#171936",
          800: "#0F1023",
          900: "#080811",
        },
        gold: {
          DEFAULT: "#C9A84C",
          50: "#FBF5E6",
          100: "#F5E8C2",
          200: "#EDD18A",
          300: "#E5BA52",
          400: "#C9A84C",
          500: "#A68A3A",
          600: "#836C2A",
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
