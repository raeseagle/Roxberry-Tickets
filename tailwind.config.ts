import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#4A0A48',
          900: '#5C0E5A',
          850: '#6A1268',
          800: '#771674',
          700: '#9C3F99',
          600: '#B565B1',
        },
        silver: {
          100: '#FFFFFF',
          200: '#F8EEF7',
          300: '#EED9ED',
          400: '#DDB9DB',
          500: '#C99AC6',
        },
        jazz: 'var(--jazz)',
        'jazz-accent': 'var(--jazz-accent)',
        mammoth: 'var(--mammoth)',
        'mammoth-accent': 'var(--mammoth-accent)',
      },
      fontFamily: {
        display: ['Fredoka', '"Arial Rounded MT Bold"', 'Arial', 'sans-serif'],
        body: ['Nunito', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        cond: ['Fredoka', '"Arial Rounded MT Bold"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
