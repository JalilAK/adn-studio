export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif']
      },
      colors: {
        brand: {
          dark: '#242a59',
          mid: '#374493',
          light: '#4a5bb5'
        }
      }
    }
  },
  plugins: []
}
