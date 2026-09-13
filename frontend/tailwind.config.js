/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        chumbo: {
          950: 'rgb(var(--color-chumbo-950) / <alpha-value>)',
          900: 'rgb(var(--color-chumbo-900) / <alpha-value>)',
          850: 'rgb(var(--color-chumbo-850) / <alpha-value>)',
          800: 'rgb(var(--color-chumbo-800) / <alpha-value>)',
          750: 'rgb(var(--color-chumbo-750) / <alpha-value>)',
          700: 'rgb(var(--color-chumbo-700) / <alpha-value>)',
          600: 'rgb(var(--color-chumbo-600) / <alpha-value>)',
          500: 'rgb(var(--color-chumbo-500) / <alpha-value>)',
        },
        laser: {
          500: '#06b6d4',
          400: '#22d3ee',
          glow: 'rgba(6, 182, 212, 0.25)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'chumbo-glow': '0 0 25px -5px rgba(255, 255, 255, 0.05)',
        'laser-glow': '0 0 20px 0px rgba(6, 182, 212, 0.25)',
      }
    },
  },
  plugins: [],
}
