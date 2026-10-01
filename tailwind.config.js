/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        link: 'var(--link)',
        'btn-bg': 'var(--btn-bg)',
        'btn-border': 'var(--btn-border)',
        good: 'var(--good)',
        warn: 'var(--warn)',
        bad: 'var(--bad)',
        'row-hover': 'var(--row-hover)',
        'table-head-bg': 'var(--table-head-bg)',
        'row-highlight': 'var(--row-highlight)',
      },
    },
  },
  plugins: [],
};
