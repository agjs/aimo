/**
 * @file DotEnvParse.behavior.ts
 * @layer core
 * @description Parse `.env`-style line-oriented `KEY=value` content into a flat map (no file I/O).
 */

/**
 * Parses dotenv-style text into key/value pairs.
 * - Ignores blank lines and full-line `#` comments.
 * - Strips optional single/double quotes around values.
 * - Tolerates leading `export ` before the key (common in shell-exported snippets).
 * - Does **not** perform variable expansion or multiline values.
 * @param raw - Full file contents.
 * @returns Map of environment variable names to values.
 */
export function parseDotEnvContents(raw: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');

    if (eq <= 0) {
      continue;
    }

    let key = trimmed.slice(0, eq).trim();

    if (key.startsWith('export ')) {
      key = key.slice('export '.length).trim();
    }

    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key !== '') {
      out[key] = value;
    }
  }

  return out;
}
