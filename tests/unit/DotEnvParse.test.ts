/**
 * @file DotEnvParse.test.ts
 * @description Unit tests for {@link parseDotEnvContents}.
 */

import { parseDotEnvContents } from '@core/config/DotEnvParse.behavior';
import { describe, expect, it } from 'bun:test';

describe('parseDotEnvContents', () => {
  it('parses basic KEY=value pairs', () => {
    expect(parseDotEnvContents('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignores blank lines and hash comments', () => {
    const raw = '\n# ignored\n\nHELLO=world\n';
    expect(parseDotEnvContents(raw)).toEqual({ HELLO: 'world' });
  });

  it('strips matching quotes and supports export prefix', () => {
    const raw = 'export X="1"\nY=\'two\'\n';
    expect(parseDotEnvContents(raw)).toEqual({ X: '1', Y: 'two' });
  });
});
