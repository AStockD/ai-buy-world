/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#7C3AED',
          light: '#EDE9FE',
          dark: '#5B21B6',
          glow: 'rgba(124,58,237,0.15)',
        },
        accent: {
          DEFAULT: '#F97316',
          light: '#FFF7ED',
        },
        success: {
          DEFAULT: '#10B981',
          light: '#D1FAE5',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
        },
        danger: {
          DEFAULT: '#EF4444',
        },
        sidebar: {
          bg: '#13111A',
          border: 'rgba(255,255,255,0.06)',
          hover: 'rgba(255,255,255,0.06)',
          active: 'rgba(124,58,237,0.25)',
          text: '#C4B5FD',
          muted: '#64748B',
        },
        surface: {
          bg: '#F5F5FA',
          card: '#FFFFFF',
          '2': '#F8F8FD',
        },
        border: {
          DEFAULT: '#E8E6F0',
          light: '#F1F0F8',
        },
        txt: {
          DEFAULT: '#1A1625',
          '2': '#4B4466',
          muted: '#8B83A8',
        },
      },
      boxShadow: {
        sm: '0 1px 3px rgba(100,80,160,0.08)',
        md: '0 4px 12px rgba(100,80,160,0.1)',
        lg: '0 12px 36px rgba(100,80,160,0.14)',
      },
      borderRadius: {
        bubble: '18px',
      },
      safeArea: {
        top: 'env(safe-area-inset-top)',
        bottom: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};
