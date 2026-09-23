/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f4faf5',
          100: '#e6f3e8',
          200: '#c8e6cc',
          300: '#a8d5ae',
          400: '#86c095',
          500: '#6aab7a',
          600: '#528f62',
          700: '#42734f',
          800: '#375c42',
          900: '#2f4c38',
          950: '#1a2e21',
        },
        blush: {
          50: '#fdf5f7',
          100: '#fce8ee',
          200: '#f9d0dc',
          300: '#f3adc0',
          400: '#e88aa4',
          500: '#d96a88',
          600: '#c04d6c',
          700: '#a03d57',
          800: '#85364b',
          900: '#713142',
          950: '#431722',
        },
        cream: {
          50: '#fefdfb',
          100: '#faf8f4',
          200: '#f5f0e8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 32px rgba(134, 192, 149, 0.2)',
        'glow-pink': '0 0 32px rgba(232, 138, 164, 0.18)',
        card: '0 4px 24px rgba(82, 143, 98, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
