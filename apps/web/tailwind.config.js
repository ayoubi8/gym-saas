/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-900': '#0B1F14',
        'brand-700': '#14532D',
        'brand-500': '#22C55E',
        'brand-100': '#DCFCE7',
        'ink-900': '#111827',
        'ink-600': '#4B5563',
        'ink-400': '#9CA3AF',
        surface: '#FFFFFF',
        'surface-2': '#F3F4F6',
        line: '#E5E7EB',
        'danger-600': '#DC2626',
        'danger-100': '#FEE2E2',
        'warn-600': '#D97706',
        'warn-100': '#FEF3C7',
        'info-600': '#2563EB',
        'success-600': '#16A34A',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Kufi Arabic', 'Cairo', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        lg: '8px',
      },
    },
  },
  plugins: [],
};
