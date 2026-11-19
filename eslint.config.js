// ESLint flat config. Warnings are errors (`--max-warnings 0` in package.json); a suppression needs a written reason in the
// step's note (docs/migration/<step>.md).
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'docs/migration/measurements/**',
      '**/*.d.ts',
      'packages/*/test/fixtures/**',
      'eng/tests/fixtures/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.strictTypeChecked,
  ...ts.configs.stylisticTypeChecked,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  {
    // build scripts and configs are plain JS run by Node
    files: ['eng/**/*.mjs', '*.config.js', '*.config.ts', 'eng/**/*.js'],
    extends: [ts.configs.disableTypeChecked],
    rules: { 'no-console': 'off', '@typescript-eslint/explicit-module-boundary-types': 'off' },
  },
);
