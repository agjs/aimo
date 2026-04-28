/**
 * @file .dependency-cruiser.cjs
 * @description Second architectural boundary check (mirrors eslint-plugin-boundaries).
 * @see {@link https://github.com/sverweij/dependency-cruiser}
 */
module.exports = {
  forbidden: [
    {
      name: 'core-cannot-import-runtime',
      severity: 'error',
      comment: 'core/** is pure brain. It must not depend on runtime, app, features, or providers.',
      from: { path: '^src/core' },
      to: { path: '^src/(runtime|features|app|providers)' },
    },
    {
      name: 'core-cannot-import-providers',
      severity: 'error',
      comment:
        'core/** must not import provider implementations (types-only imports use type-only paths in TS; dep-cruise follows values).',
      from: { path: '^src/core' },
      to: { path: '^src/providers' },
    },
    {
      name: 'shared-is-leaf',
      severity: 'error',
      comment:
        'shared/** (except test-fakes) is a leaf. test-fakes may import @core/ports to implement fakes.',
      from: { path: '^src/shared', pathNot: '^src/shared/test-fakes' },
      to: { path: '^src/(core|runtime|features|app|providers)' },
    },
    {
      name: 'shared-test-fakes-no-heavy-layers',
      severity: 'error',
      comment:
        'test-fakes implement ports; they must not depend on app/features/runtime/providers.',
      from: { path: '^src/shared/test-fakes' },
      to: { path: '^src/(runtime|features|app|providers)' },
    },
    {
      name: 'features-cannot-import-runtime',
      severity: 'error',
      comment: 'features/** receives ports from app; must not import Bun adapters.',
      from: { path: '^src/features' },
      to: { path: '^src/runtime' },
    },
    {
      name: 'features-cannot-import-app',
      severity: 'error',
      from: { path: '^src/features' },
      to: { path: '^src/app' },
    },
    {
      name: 'runtime-cannot-import-app',
      severity: 'error',
      comment: 'Runtime must never depend on the composition root.',
      from: { path: '^src/runtime' },
      to: { path: '^src/app' },
    },
    {
      name: 'runtime-cannot-import-providers',
      severity: 'error',
      comment: 'Http/shell/fs ports are generic; provider adapters consume ports, not vice versa.',
      from: { path: '^src/runtime' },
      to: { path: '^src/providers' },
    },
    {
      name: 'providers-cannot-import-features',
      severity: 'error',
      from: { path: '^src/providers' },
      to: { path: '^src/features' },
    },
    {
      name: 'providers-cannot-import-app',
      severity: 'error',
      from: { path: '^src/providers' },
      to: { path: '^src/app' },
    },
    {
      name: 'providers-cannot-import-runtime',
      severity: 'error',
      from: { path: '^src/providers' },
      to: { path: '^src/runtime' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular deps are architectural smell.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Orphaned module (no one imports it).',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(package|package-lock)\\.json$',
          '^src/app/cli\\.ts$',
          '^src/shared/.*/index\\.ts$',
          '^tests/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
