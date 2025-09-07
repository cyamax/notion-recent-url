/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js,css}",
    "./public/**/*.{html,js,css}"
  ],
  theme: {
    extend: {
      colors: {
        notion: {
          50: '#fafafa',
          100: '#f5f5f4',
          200: '#e9e9e7',
          300: '#ddddda',
          400: '#9b9a97',
          500: '#787774',
          600: '#5e5c58',
          700: '#46443e',
          800: '#37352f',
          900: '#2f2e29'
        }
      }
    },
  },
  plugins: [],
}
