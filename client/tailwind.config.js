/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Work Sans", "Inter", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      colors: {
        vakera: {
          profundo: "#182920",
          oscuro: "#1e3226",
          musgo: "#33512f",
          brote: "#8fb56b",
          "brote-osc": "#6f9a4f",
          crema: "#f1ecdd",
          "crema-suave": "#f8f5eb",
          tierra: "#6b4a32",
          carbon: "#16211a",
          surface: "#1a2e22",
          card: "#1e3528",
          cardHover: "#233f30",
          border: "rgba(143, 181, 107, 0.18)",
        },
        sidebar: {
          bg: "#14221a",
          active: "#243e2e",
          hover: "#1c3224",
          border: "rgba(143, 181, 107, 0.15)",
        },
        brand: {
          green: "#8fb56b",
          blue: "#3b82f6",
          orange: "#d97706",
          red: "#ef4444",
        },
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(0, 0, 0, 0.25)",
        glow: "0 0 20px -2px rgba(143, 181, 107, 0.2)",
      },
    },
  },
  plugins: [],
};
