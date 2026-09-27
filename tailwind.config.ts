import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/context/**/*.{js,ts,jsx,tsx,mdx}',
    './src/views/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Manrope', 'sans-serif'],
      },
      colors: {
        background: '#F7F8FA',
        card: '#FFFFFF',
        border: '#E5E7EB',
        text: {
          primary: '#1F2937',
          secondary: '#6B7280',
        },
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
        },
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#0EA5E9',
        disabled: '#D1D5DB',
      },
      borderRadius: {
        DEFAULT: '10px',
        md: '12px',
        lg: '14px',
      },
      boxShadow: {
        'sm-card': '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
