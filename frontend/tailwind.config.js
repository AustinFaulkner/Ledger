/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0C0E",
        surface: "#141518",
        surface2: "#1B1D21",
        parchment: "#ECE7DD",
        muted: "#9A958B",
        line: "rgba(236,231,221,0.10)",
        brass: "#C8A95C",
        brassdim: "#9C854A",
        positive: "#6FB78F",
        negative: "#D2876B",
      },
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        body: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      boxShadow: {
        panel:
          "inset 0 1px 0 rgba(236,231,221,0.04), 0 24px 70px -40px rgba(0,0,0,0.9)",
      },
      letterSpacing: {
        masthead: "0.18em",
      },
    },
  },
  plugins: [],
};
