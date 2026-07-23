/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F6F1E6',
          soft: '#FCFAF3',
          card: '#FFFFFF',
        },
        ink: {
          DEFAULT: '#221D16',
          muted: '#5C5346',
          faint: '#8A806E',
        },
        brand: {
          50: '#EAF2EE',
          100: '#CFE2D8',
          300: '#7FAE97',
          500: '#1F4B3F',
          600: '#193E34',
          700: '#123028',
        },
        amber: {
          400: '#E4B23F',
          500: '#D9A441',
          600: '#B9832A',
        },
        brick: {
          400: '#C85A47',
          500: '#B23A2E',
          600: '#8F2C22',
        },
        sage: {
          400: '#6FA391',
          500: '#4C7A6B',
        },
      },
      fontFamily: {
        display: ['"Oswald"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        ticket: '0 1px 2px rgba(34, 29, 22, 0.06), 0 4px 12px rgba(34, 29, 22, 0.08)',
      },
      borderRadius: {
        ticket: '10px',
      },
    },
  },
  plugins: [],
};
