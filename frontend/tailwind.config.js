/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6366f1',   // indigo-500
          dark:    '#4f46e5',   // indigo-600
        },
        surface: {
          DEFAULT: '#1e1e2e',  // main bg
          card:    '#2a2a3e',  // card bg
          border:  '#3b3b52',  // border
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
