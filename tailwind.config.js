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
        sans: ['var(--font-family-base)', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          surface: 'var(--bg-surface)',
          muted: 'var(--bg-muted)',
        },
        text: {
          primary: 'var(--text-primary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          primary: withOpacity('--accent-primary-rgb'),
          soft: withOpacity('--accent-soft-rgb'),
        },
        cta: {
          primary: withOpacity('--cta-primary-rgb'),
          secondary: withOpacity('--cta-secondary-rgb'),
        },
        border: {
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        primary: withOpacity('--cta-primary-rgb'),
        success: 'var(--support-success)',
        danger: 'var(--support-danger)',
      },
      boxShadow: {
        level1: 'var(--shadow-level-1)',
        level2: 'var(--shadow-level-2)',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
    },
  },
  plugins: [],
}
