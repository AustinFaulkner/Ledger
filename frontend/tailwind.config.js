/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /* Windows 11 Fluent-inspired light theme: mica-gray window, white cards,
         Segoe UI, Windows accent blue. Token names are kept from the old dark
         theme so the components read the same — only the values are light now.
         ink = window background, parchment = primary text. */
      colors: {
        ink: "#F3F3F3",
        surface: "#FFFFFF",
        surface2: "#FAFAFA",
        parchment: "#1B1B1B",
        muted: "#616161",
        line: "#E5E5E5",
        brass: "#005FB8",
        brassdim: "#00529F",
        positive: "#0F7B0F",
        negative: "#C42B1C",
      },
      fontFamily: {
        display: ['"Segoe UI Variable Display"', '"Segoe UI"', "system-ui", "sans-serif"],
        body: ['"Segoe UI Variable Text"', '"Segoe UI"', "system-ui", "sans-serif"],
        mono: ['"Cascadia Mono"', "Consolas", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(0,0,0,0.06), 0 4px 12px -8px rgba(0,0,0,0.18)",
      },
      letterSpacing: {
        masthead: "0.18em",
      },
    },
  },
  plugins: [],
};
