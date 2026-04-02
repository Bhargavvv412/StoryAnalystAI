/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          blue:   "#0066FF",
          purple: "#7C3AED",
          navy:   "#0F172A",
          "blue-light":   "#3385FF",
          "purple-light": "#9D6FEF",
          "navy-light":   "#1E293B",
        },
        surface: {
          DEFAULT: "#0F172A",
          card:    "rgba(255,255,255,0.05)",
          hover:   "rgba(255,255,255,0.08)",
          border:  "rgba(255,255,255,0.10)",
        },
      },
      backgroundImage: {
        "brand-gradient":        "linear-gradient(135deg, #0066FF 0%, #7C3AED 50%, #0F172A 100%)",
        "brand-gradient-subtle": "linear-gradient(135deg, rgba(0,102,255,0.15) 0%, rgba(124,58,237,0.15) 100%)",
        "card-gradient":         "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        "glow-blue":             "radial-gradient(ellipse at top, rgba(0,102,255,0.3) 0%, transparent 60%)",
        "glow-purple":           "radial-gradient(ellipse at bottom, rgba(124,58,237,0.3) 0%, transparent 60%)",
      },
      boxShadow: {
        glass:    "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow:     "0 0 20px rgba(0, 102, 255, 0.4)",
        "glow-purple": "0 0 20px rgba(124, 58, 237, 0.4)",
        card:     "0 4px 24px rgba(0, 0, 0, 0.3)",
      },
      animation: {
        shimmer:   "shimmer 2s linear infinite",
        "fade-in": "fadeIn 0.5s ease-in-out",
        float:     "float 6s ease-in-out infinite",
        pulse:     "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          "0%":   { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-10px)" },
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
  ],
};
