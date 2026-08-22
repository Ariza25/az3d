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
          950: '#0a0b0d',
          900: '#111318',
          850: '#161920',
          800: '#1c202a',
          700: '#2a303f',
          600: '#3d4559',
          500: '#525d78',
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
