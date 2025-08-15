import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f6f9ff',
          100: '#eaf1ff',
          200: '#d6e2ff',
          300: '#b5cbff',
          400: '#8eabff',
          500: '#6a8dff',
          600: '#4f6ff1',
          700: '#435cd1',
          800: '#384ca8',
          900: '#2f4187'
        }
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        xl: '1rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
