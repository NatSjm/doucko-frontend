import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import noLiteralUiText from './eslint-rules/no-literal-ui-text.js';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // Vendored design system and generated API client are never linted (AGENTS.md, NFR-12);
  // installed harness files (scripts/, .claude/, templates/, ...) belong to ../docs/factory.
  globalIgnores([
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    'node_modules',
    'contract',
    'scripts',
    '.claude',
    'templates',
    'quality',
    'retro',
    'trace',
    'src/design-system',
    'src/api/generated',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
  {
    files: ['e2e/**/*.ts', '*.config.ts', 'tools/**/*.mjs', 'eslint-rules/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  // NFR-9: UI text only from the message catalog. Tests may use literals (they assert on them).
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx'],
    plugins: { doucko: { rules: { 'no-literal-ui-text': noLiteralUiText } } },
    rules: { 'doucko/no-literal-ui-text': 'error' },
  },
]);
