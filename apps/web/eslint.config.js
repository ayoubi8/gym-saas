import tseslint from 'typescript-eslint';

// Phase 6 (PRD §5.7 FR-L1): keep user-facing text out of components.
// Heuristic guardrails — documented limits:
//  - catches literal JSX text containing Latin/Arabic letters, and literal
//    string values for placeholder / aria-label / title / alt;
//  - does NOT catch strings passed as props, template concatenations, computed
//    text from data, or literals in other attributes — those rely on review +
//    the i18n key-coverage test (`src/tests/i18n-rtl.test.ts`).
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/[A-Za-z\\u0600-\\u06FF]/]',
          message: 'Hard-coded UI text — use t("…") from i18next (AGENTS.md §6).',
        },
        {
          selector:
            'JSXAttribute[name.name=/^(placeholder|aria-label|title|alt)$/] > Literal[value=/[A-Za-z\\u0600-\\u06FF]/]',
          message: 'Hard-coded user-facing attribute — use t("…") from i18next (AGENTS.md §6).',
        },
      ],
    },
  }
);
