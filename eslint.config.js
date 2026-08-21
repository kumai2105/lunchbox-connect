import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'supabase/functions', 'node_modules', 'test-results', 'playwright-report'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Auth provider legitimately exports hooks alongside the provider component.
    files: ['src/lib/auth.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Node-side ESM: the Playwright harness and the build script.
    //
    // `__dirname` and `__filename` do not exist in an ES module, and this
    // package is `"type": "module"`. TypeScript cannot object — @types/node
    // declares both as globals regardless of module system — and
    // typescript-eslint disables `no-undef`, so a reference to either
    // typechecks, lints and builds cleanly and then throws at runtime. That is
    // precisely what happened in tests/e2e/fixtures.ts: one line took out all
    // 27 browser tests. Ban them outright here and name the replacement.
    files: ['tests/**/*.ts', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: '__dirname',
          message:
            'Not defined in ESM. Use path.dirname(fileURLToPath(import.meta.url)).',
        },
        {
          name: '__filename',
          message: 'Not defined in ESM. Use fileURLToPath(import.meta.url).',
        },
      ],
    },
  },
);
