/**
 * @file ExecuteResultJson.test.ts
 */

import { CURRENT_SCHEMA_VERSION } from '@core/contracts/SchemaVersion.constants';
import { serializeExecuteResultJson } from '@core/execute/ExecuteResultJson.behavior';
import { describe, expect, it } from 'bun:test';

describe('serializeExecuteResultJson', () => {
  it('pretty-prints execute.result.json with trailing newline', () => {
    const text = serializeExecuteResultJson({
      schema_version: CURRENT_SCHEMA_VERSION,
      run_id: 'r',
      stage: 'execute',
      exit_code: 2,
      git_diff_head_error: 'before: not a git repo',
    });
    expect(text.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(text) as { exit_code: number; git_diff_head_error: string };
    expect(parsed.exit_code).toBe(2);
    expect(parsed.git_diff_head_error).toContain('git');
  });
});
