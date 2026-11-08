/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#091416', 900: '#0D1B1E', 800: '#13272B', 700: '#1B3438', 600: '#27474C' },
        bone: { DEFAULT: '#E8EEE6', dim: '#C3D0C9' },
        mute: '#8EA9A5',
        marigold: { DEFAULT: '#F0B03A', deep: '#C98E1F' },
        coral: '#EF6F5A',
        mint: '#6ED3A3',
        sky: '#79B8D9',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { tab: '10px', panel: '18px' },
    },
  },
  plugins: [],
};
