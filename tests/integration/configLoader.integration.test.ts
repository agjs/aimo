import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadAimoConfigFromPaths } from '@runtime/bun/ConfigLoader.bun';
import { describe, expect, it } from 'bun:test';

describe('loadAimoConfigFromPaths', () => {
  it('merges user then project so project wins on conflicts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-cfg-'));
    const userPath = join(root, 'user.yaml');
    const projectPath = join(root, 'project.yaml');

    await writeFile(
      userPath,
      `
schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: user
      model: old
`,
      'utf8',
    );

    await writeFile(
      projectPath,
      `
profiles:
  default:
    plan:
      provider: project
      model: new
`,
      'utf8',
    );

    const result = await loadAimoConfigFromPaths({
      userYamlPath: userPath,
      projectYamlPath: projectPath,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.config.profiles.default?.plan?.provider).toBe('project');
    expect(result.config.profiles.default?.plan?.model).toBe('new');
    expect(result.paths.userYamlPresent).toBe(true);
    expect(result.paths.projectYamlPresent).toBe(true);
  });
});
