import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import noAtlasStringLeak from './eslint-rules/no-atlas-string-leak.js'

export default tseslint.config(
  { ignores: ['dist', 'be-src', '**/be-src/**', '.wrangler/**', 'android', 'android/**'] },
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
    },
    rules: {
      // Start as warn until RA-006 call sites are migrated (then flip to error).
      'atlas-brand/no-atlas-string-leak': 'warn',
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
)
