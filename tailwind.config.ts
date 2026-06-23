import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eefbe8",
          100: "#d8f6ca",
          200: "#b9eda0",
          300: "#93df6e",
          400: "#70cf42",
          500: "#58bd2f",
          600: "#429623",
          700: "#34731f",
          800: "#2d5c20",
          900: "#264d1f",
        },
        duoBlue: "#1cb0f6",
        duoYellow: "#ffc800",
        duoOrange: "#ff9600",
        duoRed: "#ff4b4b",
        ink: "#2b2f33",
        amber: {
          50: "#fff7e6",
          700: "#b35900",
          800: "#8f4400",
        },
      },
      borderRadius: {
        xl: "18px",
        "2xl": "24px",
      },
      boxShadow: {
        button: "0 5px 0 rgba(0,0,0,0.18)",
        card: "0 2px 0 rgba(0,0,0,0.08)",
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        slideUpFade: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSlow: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        }
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
        slideUpFade: 'slideUpFade 0.2s ease-out forwards',
        pulseSlow: 'pulseSlow 1.6s ease-in-out infinite',
      }
    },
  },
  plugins: [],
} satisfies Config;
