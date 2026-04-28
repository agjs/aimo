/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // config-conventional caps line/length; we prefer long subjects and bodies.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'header-max-length': [0],
    'subject-max-length': [0],
    'subject-full-stop': [2, 'never', '.'],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'perf', 'refactor', 'revert', 'chore', 'docs', 'test', 'build', 'ci'],
    ],
  },
};
