const withOpacity = (variable) => {
  return ({ opacityValue } = {}) => {
    if (opacityValue === undefined) {
      return `rgb(var(${variable}) / 1)`;
    }

    return `rgb(var(${variable}) / ${opacityValue})`;
  };
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        roboto: ['Roboto Slab', 'serif'],
        sans: ['var(--font-family-base)', 'DM Sans', 'system-ui', 'sans-serif'],
        display: ['var(--font-family-display)', 'Cormorant Garamond', 'Georgia', 'serif'],      },
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          surface: 'var(--bg-surface)',
          muted: 'var(--bg-muted)',
          card: 'var(--bg-card)',      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        'section-gap': 'var(--section-gap-mobile)',
        'section-gap-md': 'var(--section-gap-tablet)',
        'section-gap-lg': 'var(--section-gap-desktop)',      },
    },
  },
  plugins: [],
}
