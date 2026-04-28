import js from '@eslint/js';
import boundariesPlugin from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architectural layers for aimo (CLI). Boundaries match `.dependency-cruiser.cjs`.
 * @see {@link https://github.com/javierbrea/eslint-plugin-boundaries}
 */
const ARCH_ELEMENTS = [
  { type: 'shared', pattern: 'src/shared/**' },
  { type: 'core', pattern: 'src/core/**' },
  { type: 'providers', pattern: 'src/providers/**' },
  { type: 'runtime', pattern: 'src/runtime/**' },
  { type: 'features', pattern: 'src/features/**' },
  { type: 'app', pattern: 'src/app/**' },
];

/** @see {@link https://www.jsboundaries.dev/docs/releases/migration-guides/v5-to-v6/} */
const ARCH_DEPENDENCY_RULES = [
  {
    from: { type: 'shared' },
    allow: { to: { type: ['shared', 'core'] } },
  },
  { from: { type: 'core' }, allow: { to: { type: ['core', 'shared'] } } },
  {
    from: { type: 'providers' },
    allow: { to: { type: ['providers', 'core', 'shared'] } },
  },
  { from: { type: 'runtime' }, allow: { to: { type: ['runtime', 'core', 'shared'] } } },
  {
    from: { type: 'features' },
    allow: { to: { type: ['features', 'core', 'providers', 'shared'] } },
  },
  {
    from: { type: 'app' },
    allow: {
      to: { type: ['app', 'features', 'runtime', 'providers', 'core', 'shared'] },
    },
  },
];

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.husky/**',
      '.dependency-cruiser.cjs',
      'docs/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  jsdoc.configs['flat/recommended-typescript-error'],

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.cjs', '*.mjs', '*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    plugins: {
      boundaries: boundariesPlugin,
      import: importPlugin,
    },
    settings: {
      'boundaries/elements': ARCH_ELEMENTS,
      'boundaries/include': ['src/**/*'],
      'import/resolver': {
        typescript: { project: ['./tsconfig.json'] },
      },
    },
    rules: {
      'boundaries/dependencies': ['error', { default: 'disallow', rules: ARCH_DEPENDENCY_RULES }],
      'boundaries/no-unknown': 'error',
      'boundaries/no-unknown-files': 'off',

      'no-console': 'off',

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      'import/no-cycle': ['error', { maxDepth: 10 }],
      'import/no-default-export': 'error',
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [
            { pattern: '@app/**', group: 'internal', position: 'before' },
            { pattern: '@features/**', group: 'internal', position: 'before' },
            { pattern: '@runtime/**', group: 'internal', position: 'before' },
            { pattern: '@providers/**', group: 'internal', position: 'before' },
            { pattern: '@core/**', group: 'internal', position: 'before' },
            { pattern: '@shared/**', group: 'internal', position: 'before' },
          ],
        },
      ],

      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 15],

      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            MethodDefinition: true,
          },
          contexts: [
            'ExportNamedDeclaration > FunctionDeclaration',
            'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=/^[A-Z]/]',
          ],
        },
      ],
      'jsdoc/check-tag-names': [
        'error',
        {
          typed: true,
          definedTags: ['file', 'layer'],
        },
      ],
    },
  },

  {
    files: ['commitlint.config.js'],
    rules: {
      'jsdoc/check-tag-names': 'off',
    },
  },

  // core: pure — no wall-clock, no random, no process/Bun I/O globals
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Use IHttpPort instead of fetch() in core/.' },
        { name: 'Bun', message: 'core/ must not reference Bun. Use ports + runtime/.' },
        { name: 'process', message: 'core/ must not read process. Inject env via app/.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Inject IRandomPort instead of Math.random() in core/.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Inject IClockPort instead of Date.now() in core/.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Inject IClockPort instead of new Date() in core/.',
        },
      ],
    },
  },

  // features: never import concrete Bun adapters (composition root is app/)
  {
    files: ['src/features/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@runtime/*'],
              message:
                'features/ must not import @runtime. Receive ports from app/wireDefaults (tests use fakes).',
            },
          ],
        },
      ],
    },
  },

  // runtime: generic adapters only — must not depend on LLM providers
  {
    files: ['src/runtime/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@providers/*'],
              message:
                'runtime/ must not import @providers. HttpPort is generic; adapters live in providers/.',
            },
          ],
        },
      ],
    },
  },

  // app + runtime: may use Node/Bun APIs
  {
    files: ['src/app/**/*.ts', 'src/runtime/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  {
    files: [
      'src/app/cli.ts',
      'eslint.config.js',
      'commitlint.config.js',
      '.dependency-cruiser.cjs',
    ],
    rules: {
      'import/no-default-export': 'off',
    },
  },

  {
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    rules: {
      'max-lines': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
      'jsdoc/require-jsdoc': 'off',
    },
  },
);
