/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#0B5FFF',
        accent: '#FFB400',
        ink: '#0F172A',
        success: '#16A34A',
        danger: '#DC2626',
      },
    },
  },
  plugins: [],
};
