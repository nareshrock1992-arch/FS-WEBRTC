import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'certs/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: globals.browser },
    rules: {
      // Security: never build DOM from strings.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use textContent / DOM APIs (XSS protection).' },
        { property: 'outerHTML', message: 'Use DOM APIs (XSS protection).' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    files: ['server/**/*.mjs', 'scripts/**/*.mjs', '*.config.*'],
    languageOptions: { globals: globals.node },
  },
);
