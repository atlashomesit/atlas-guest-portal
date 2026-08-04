import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import noAtlasStringLeak from './eslint-rules/no-atlas-string-leak.js'
import noCoerceNumericOnchange from './eslint-rules/no-coerce-numeric-onchange.cjs'
import noUtcToday from './eslint-rules/no-utc-today.cjs'

export default tseslint.config(
  { ignores: ['dist', 'be-src', '**/be-src/**', '.wrangler/**', 'android', 'android/**', '.claude/worktrees/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      // RA-006: prevents hardcoded Atlas brand strings from leaking into white-label tenants
      'atlas-brand': { rules: { 'no-atlas-string-leak': noAtlasStringLeak } },
      atlas: {
        rules: {
          'no-coerce-numeric-onchange': noCoerceNumericOnchange,
          'no-utc-today': noUtcToday,
        },
      },
    },
    rules: {
      // Start as warn until RA-006 call sites are migrated (then flip to error).
      'atlas-brand/no-atlas-string-leak': 'warn',
      'atlas/no-coerce-numeric-onchange': 'error',
      'atlas/no-utc-today': 'error',
      ...reactHooks.configs.recommended.rules,
      // react-hooks@7.x added React Compiler rules not yet enforced in this codebase
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
      'preserve-caught-error': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Test files may construct raw UTC date strings for fixtures/assertions (they control
    // the clock) — exempt them from atlas custom rules, mirroring the admin portal.
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', 'tests/**'],
    rules: {
      'atlas/no-coerce-numeric-onchange': 'off',
      'atlas/no-utc-today': 'off',
    },
  },
  {
    // TASK-4903 / ADR-0081 amendment 2026-07-17 point 6 — "Theme ≠ integration" HARD RULE
    // (AGENTS.md): dependency direction is one-way, themes consume the shared library, never
    // the reverse. No module outside `src/themes/` may import from `src/themes/`, with exactly
    // one override: the theme mount point (`src/App.tsx`/`src/main.tsx` importing
    // `src/themes/registry`). Blanket restriction (not an enumerated shared-dir list) so new
    // `src/` folders are covered by default — only the two mount files and `src/themes/**`
    // itself (intra-theme imports) are exempted below.
    files: ['**/*.{ts,tsx}'],
    // `src/test/setup.ts` is test-lifecycle infrastructure (not production integration code):
    // it imports registry.ts's `_resetCurrentLayoutThemeIdForTests()` only, the same
    // reset-between-test-files pattern already used for `tenant/tenantContext`'s
    // `_resetTenantContextForTests()` — it never reads/depends on theme *content*.
    ignores: ['src/themes/**', 'src/App.tsx', 'src/main.tsx', 'src/test/setup.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Deliberately requires a sub-path segment after "themes/" — a bare "**/themes"
              // pattern would also match `./themes` in `src/theme/ThemeProvider.tsx` (the
              // pre-existing, singular `src/theme/` color-preset-option-list module, a
              // different and unrelated directory this ADR explicitly does not touch).
              group: ['**/themes/*', '@/themes/*'],
              message:
                'Theme boundary (ADR-0081 amendment 2026-07-17 pt.6; AGENTS.md HARD RULE "Theme ≠ integration"): only src/App.tsx and src/main.tsx may import from src/themes/. Theme packages are presentation-only, consumed solely at the mount point — a needed shared-layer change belongs in a separate, theme-agnostic PR.',
            },
          ],
        },
      ],
    },
  },
)
