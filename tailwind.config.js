/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-neutral-400',
    'bg-neutral-700',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} 