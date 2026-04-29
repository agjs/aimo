/**
 * @file buildRepoToolDescriptorsForModel.test.ts
 * @description Unit tests for model-facing tool descriptors filtered by approval level.
 */

import { buildRepoToolDescriptorsForModel } from '@core/repoTools/RepoToolSchemas.behavior';
import { createDefaultToolApprovals } from '@core/session/sessionReducer.behavior';
import { describe, expect, it } from 'bun:test';

describe('buildRepoToolDescriptorsForModel', () => {
  it('omits deny and never tools', () => {
    const a = createDefaultToolApprovals();
    a.read_file = 'allow';
    a.grep = 'deny';
    a.web_search = 'never';
    const d = buildRepoToolDescriptorsForModel(a);
    const names = d.map((t) => t.function.name).sort();
    expect(names).toContain('read_file');
    expect(names).not.toContain('grep');
    expect(names).not.toContain('web_search');
  });

  it('includes allow, session, and ask', () => {
    const a = createDefaultToolApprovals();
    a.read_file = 'allow';
    a.grep = 'session';
    a.list_tree = 'ask';
    a.git_status = 'deny';
    const d = buildRepoToolDescriptorsForModel(a);
    const names = d.map((t) => t.function.name).sort();
    expect(names).toEqual(['grep', 'list_tree', 'read_file'].sort());
  });
});
