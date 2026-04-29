import { matchPathAgainstSimpleGlob } from '@core/repoTools/simpleGlobPredicate.behavior';
import { describe, expect, it } from 'bun:test';

describe('matchPathAgainstSimpleGlob', () => {
  it('matches all when glob is undefined or empty', () => {
    expect(matchPathAgainstSimpleGlob('src/a.ts', undefined)).toBe(true);
    expect(matchPathAgainstSimpleGlob('src/a.ts', '')).toBe(true);
    expect(matchPathAgainstSimpleGlob('src/a.ts', '   ')).toBe(true);
  });

  it('matches *.ext suffix', () => {
    expect(matchPathAgainstSimpleGlob('src/foo.ts', '*.ts')).toBe(true);
    expect(matchPathAgainstSimpleGlob('foo.ts', '*.ts')).toBe(true);
    expect(matchPathAgainstSimpleGlob('src/foo.js', '*.ts')).toBe(false);
  });

  it('matches **/*.ext', () => {
    expect(matchPathAgainstSimpleGlob('docs/readme.md', '**/*.md')).toBe(true);
    expect(matchPathAgainstSimpleGlob('readme.md', '**/*.md')).toBe(true);
  });

  it('matches plain suffix .ext', () => {
    expect(matchPathAgainstSimpleGlob('lib/x.ts', '.ts')).toBe(true);
    expect(matchPathAgainstSimpleGlob('lib/x.js', '.ts')).toBe(false);
  });

  it('matches literal path when no wildcards', () => {
    expect(matchPathAgainstSimpleGlob('aimo.yaml', 'aimo.yaml')).toBe(true);
    expect(matchPathAgainstSimpleGlob('cfg/aimo.yaml', 'aimo.yaml')).toBe(true);
    expect(matchPathAgainstSimpleGlob('other.yaml', 'aimo.yaml')).toBe(false);
  });
});
