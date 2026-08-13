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
        'brand-bg': '#f1efe7',
        'brand-bg-light': '#faf9f6',
        'brand-text': '#1a1a1a',
        'brand-text-light': '#333333',
        'brand-neutral': '#bfbfbf',
        'brand-primary': '#01537e',
        'brand-secondary': '#0271a3',
        'brand-dark': '#013b5b',
        'brand-pale': '#e1f3fa',
      },
      fontFamily: {
        "headline": ["Epilogue", "sans-serif"],
        "body": ["Manrope", "sans-serif"],
      },
    },
  },
  plugins: [],
}
