import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,ts}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        NodeJS: 'readonly',
        Express: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'unused-imports': unusedImports,
    },
    rules: {
      // Core unused imports detection - ERRORS (blocks build)
      'unused-imports/no-unused-imports': 'error',
      
      // Unused variables - WARNINGS (allows build)  
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      
      // Other rules - WARNINGS (allows build)
      'no-useless-escape': 'warn',
      'no-case-declarations': 'warn',
      
      // Turn off conflicting rules
      'no-unused-vars': 'off',
    },
  },
  {
    // Ignore patterns
    ignores: [
      'dist/**/*',
      'node_modules/**/*',
      '*.config.js',
      '*.config.ts',
    ],
  },
];