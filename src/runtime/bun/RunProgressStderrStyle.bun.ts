/**
 * @file RunProgressStderrStyle.bun.ts
 * @layer runtime
 * @description Colored stderr lines for `aimo run` progress (uses picocolors; respects NO_COLOR / TTY).
 */

// picocolors' default uses stdout.isTTY only; we also check stderr, env hints, and `aimo run --progress-color`.
import picocolors from 'picocolors';

/** User preference for the run-progress color decision. */
export type TRunProgressColorMode = 'always' | 'auto' | 'never';

type TPicocolors = ReturnType<typeof picocolors.createColors>;

function colorOptOut(): boolean {
  const env = process.env;
  const argv = process.argv ?? [];

  return (
    env.NO_COLOR !== undefined ||
    env.NODE_DISABLE_COLORS !== undefined ||
    argv.includes('--no-color')
  );
}

function envForcesAnsiColor(): boolean {
  const env = process.env;

  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') {
    return true;
  }

  const cf = env.CLICOLOR_FORCE;

  if (cf === '1' || cf === 'true' || cf === 'yes') {
    return true;
  }

  return false;
}

function argvForcesColor(): boolean {
  return (process.argv ?? []).includes('--color');
}

function streamsLookInteractive(): boolean {
  const env = process.env;
  const out = process.stdout as NodeJS.WriteStream | undefined;
  const err = process.stderr as NodeJS.WriteStream | undefined;

  return (out?.isTTY === true || err?.isTTY === true) && env.TERM !== 'dumb';
}

function autoColorEnabled(): boolean {
  if (colorOptOut()) {
    return false;
  }

  if (envForcesAnsiColor()) {
    return true;
  }

  if (argvForcesColor()) {
    return true;
  }

  if (process.platform === 'win32') {
    return true;
  }

  if (process.env.CI) {
    return true;
  }

  if (streamsLookInteractive()) {
    return true;
  }

  return false;
}

/** Bound writers for one CLI invocation; isolated from module-level state. */
export type TRunProgressStderr = {
  readonly setMode: (mode: TRunProgressColorMode) => void;
  readonly writeRunProgressLine: (body: string) => void;
  readonly writeRunProgressWarnLine: (body: string) => void;
  readonly writeRunProgressErrorLine: (body: string) => void;
  readonly writeRunStyledMessage: (line: string, kind?: 'info' | 'warn' | 'error') => void;
};

/**
 * Creates an isolated stderr-progress writer pair (mode + cached picocolors instance).
 * Tests should prefer this over the module-level helpers to avoid cross-test state leakage.
 * @param mode - Initial color preference.
 * @returns Frozen writer bundle.
 */
export function createRunProgressStderr(mode: TRunProgressColorMode = 'auto'): TRunProgressStderr {
  let progressColorMode: TRunProgressColorMode = mode;
  let cachedPc: TPicocolors | undefined;
  let cachedEnabled: boolean | undefined;

  const resolveColorsEnabled = (): boolean => {
    if (colorOptOut()) {
      return false;
    }

    if (progressColorMode === 'never') {
      return false;
    }

    if (progressColorMode === 'always') {
      return true;
    }

    return autoColorEnabled();
  };

  const getPc = (): TPicocolors => {
    const on = resolveColorsEnabled();

    if (cachedPc === undefined || cachedEnabled !== on) {
      cachedPc = picocolors.createColors(on);
      cachedEnabled = on;
    }

    return cachedPc;
  };

  const writeRunProgressLine = (body: string): void => {
    const pc = getPc();
    process.stderr.write(`${pc.bold(pc.cyanBright('run:'))} ${pc.cyan(body)}\n`);
  };

  const writeRunProgressWarnLine = (body: string): void => {
    const pc = getPc();
    process.stderr.write(`${pc.bold(pc.yellowBright('run:'))} ${pc.yellow(body)}\n`);
  };

  const writeRunProgressErrorLine = (body: string): void => {
    const pc = getPc();
    process.stderr.write(`${pc.bold(pc.redBright('run:'))} ${pc.red(body)}\n`);
  };

  const writeRunStyledMessage = (line: string, kind: 'info' | 'warn' | 'error' = 'info'): void => {
    const hasNl = line.endsWith('\n');
    const trimmed = hasNl ? line.slice(0, -1) : line;

    if (!trimmed.startsWith('run:')) {
      process.stderr.write(hasNl ? line : `${line}\n`);
      return;
    }

    const rest = trimmed.slice('run:'.length).replace(/^\s+/, '');

    if (kind === 'error') {
      writeRunProgressErrorLine(rest);
      return;
    }

    if (kind === 'warn') {
      writeRunProgressWarnLine(rest);
      return;
    }

    writeRunProgressLine(rest);
  };

  return Object.freeze({
    setMode: (m: TRunProgressColorMode): void => {
      progressColorMode = m;
      cachedPc = undefined;
      cachedEnabled = undefined;
    },
    writeRunProgressLine,
    writeRunProgressWarnLine,
    writeRunProgressErrorLine,
    writeRunStyledMessage,
  });
}

const defaultStderr = createRunProgressStderr('auto');

/**
 * Sets the color preference on the default (module-singleton) writer.
 * Composition root calls this once at the start of `aimo run`.
 * @param mode - `always` ignores TTY (still honors {@link https://no-color.org/ NO_COLOR}).
 */
export function setRunProgressColorPreference(mode: TRunProgressColorMode): void {
  defaultStderr.setMode(mode);
}

/**
 * Writes `run: ${body}\n` with a prominent cyan label (info).
 * @param body - Text after the `run:` prefix (no leading `run:`).
 */
export function writeRunProgressLine(body: string): void {
  defaultStderr.writeRunProgressLine(body);
}

/**
 * Writes `run: ${body}\n` with a yellow label (warnings / validation).
 * @param body - Text after the `run:` prefix.
 */
export function writeRunProgressWarnLine(body: string): void {
  defaultStderr.writeRunProgressWarnLine(body);
}

/**
 * Writes `run: ${body}\n` with a red label (hard failures).
 * @param body - Text after the `run:` prefix.
 */
export function writeRunProgressErrorLine(body: string): void {
  defaultStderr.writeRunProgressErrorLine(body);
}

/**
 * Styles a full message that starts with `run:`. Other lines are written unchanged.
 * @param line - Often ends with `\n`.
 * @param kind - Severity for coloring the prefix and (for warn/error) the body.
 */
export function writeRunStyledMessage(
  line: string,
  kind: 'info' | 'warn' | 'error' = 'info',
): void {
  defaultStderr.writeRunStyledMessage(line, kind);
}
