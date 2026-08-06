import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        lime: "hsl(var(--lime))",
        forest: "hsl(var(--forest))",
        coral: "hsl(var(--coral))",
        graphite: "hsl(var(--graphite))",
      },
    },
  },
  plugins: [],
};

export default config;
