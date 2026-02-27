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
        display: ['var(--font-family-display)', 'Cormorant Garamond', 'Georgia', 'serif'],
      },
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          surface: 'var(--bg-surface)',
          muted: 'var(--bg-muted)',
          card: 'var(--bg-card)',
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
          primaryHover: withOpacity('--cta-primary-hover-rgb'),
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
      maxWidth: {
        prose: '45rem',
        section: '68.75rem',
        content: '50rem',
        luxury: '1240px',
      },
      boxShadow: {
        level1: 'var(--shadow-level-1)',
        level2: 'var(--shadow-level-2)',
        level3: 'var(--shadow-level-3)',
        'hover': '0 8px 24px rgba(26, 26, 46, 0.06), 0 4px 12px rgba(26, 26, 46, 0.03)',
        'glow-brand': '0 0 24px rgba(255, 107, 53, 0.25)',
      },
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
        'section-gap-lg': 'var(--section-gap-desktop)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: '1.25rem',
        '2xl': '1.5rem',
        card: 'var(--radius-card)',
        'card-lg': 'var(--radius-card-lg)',
        pill: '9999px',
      },
      transitionDuration: {
        smooth: '200ms',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
