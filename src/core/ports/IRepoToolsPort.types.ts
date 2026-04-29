/**
 * @file IRepoToolsPort.types.ts
 * @layer core
 * @description Port for bounded repo-scoped tools (session `/read`, `/grep`, `/tree`, `/git-status`, `/git-diff`, `/show`, …).
 */

/** Parameters for {@link IRepoToolsPort.readFile}. */
export interface IReadFileParams {
  /** Relative to repo root or absolute path (still must resolve under root). */
  readonly path: string;
  /** Max UTF-8 bytes to return; adapter default when omitted. */
  readonly max_bytes?: number | undefined;
}

/** Result of a successful repo file read. */
export interface IReadFileResult {
  readonly content: string;
  readonly truncated: boolean;
  /** Line count for full read; `null` when {@link truncated} is true. */
  readonly total_lines: number | null;
}

/** Parameters for {@link IRepoToolsPort.grep}. */
export interface IGrepParams {
  /** JavaScript `RegExp` source (not wrapped); scanned line-by-line. */
  readonly pattern: string;
  /** Optional path filter (e.g. `*.ts`); see `matchPathAgainstSimpleGlob` in `core/repoTools`. */
  readonly glob?: string | undefined;
  /** Hard cap on matches returned (default 200). */
  readonly max_matches?: number | undefined;
  /** Stop walking after this many files (default 4000). */
  readonly max_files_scanned?: number | undefined;
  /** Cap on UTF-8 bytes of formatted `matches` text (default 65536). */
  readonly max_output_bytes?: number | undefined;
  /** Lines of context before/after each hit (default 0). */
  readonly context_lines?: number | undefined;
}

/** One grep row: a matching line or nearby context when {@link IGrepParams.context_lines} is set. */
export interface IGrepMatch {
  readonly path: string;
  readonly line: number;
  readonly text: string;
  /** True when this row is context (not the line that matched the pattern). */
  readonly is_context_line?: boolean | undefined;
}

/** Bounded grep result. */
export interface IGrepResult {
  readonly matches: readonly IGrepMatch[];
  readonly truncated_matches: boolean;
  readonly truncated_output: boolean;
  readonly files_scanned: number;
}

/** Parameters for {@link IRepoToolsPort.listTree}. */
export interface IListTreeParams {
  /** Relative path under repo root; empty or `.` lists from repo root. */
  readonly root?: string | undefined;
  /** Max directory nesting below the listing root (default 8). */
  readonly max_depth?: number | undefined;
  /** Max paths emitted before truncation (default 2000). */
  readonly max_entries?: number | undefined;
  /** Cap on UTF-8 bytes of joined line output (default 65536). */
  readonly max_output_bytes?: number | undefined;
}

/** Bounded tree listing (relative paths; directories end with `/`). */
export interface IListTreeResult {
  readonly lines: readonly string[];
  readonly truncated_entries: boolean;
  readonly truncated_output: boolean;
  /** Count of directories opened for listing (includes the listing root). */
  readonly dirs_visited: number;
}

/** Parameters for {@link IRepoToolsPort.gitStatus}. */
export interface IGitStatusParams {
  /** Max UTF-8 bytes of returned `output` (default 65536). */
  readonly max_output_bytes?: number | undefined;
}

/** Result of `git status` (or failure text when `exit_code` is non-zero). */
export interface IGitStatusResult {
  /** Status text (`git status --short -b` on success; stderr-oriented message on failure). */
  readonly output: string;
  readonly truncated: boolean;
  readonly exit_code: number;
}

/** Parameters for {@link IRepoToolsPort.gitDiff}. */
export interface IGitDiffParams {
  /** When true, run `git diff --cached` (index vs `HEAD`). Default false: `git diff HEAD`. */
  readonly staged?: boolean | undefined;
  /** Max UTF-8 bytes of returned `output` (default 65536). */
  readonly max_output_bytes?: number | undefined;
}

/** Result of `git diff` (or failure text when `exit_code` is non-zero). */
export interface IGitDiffResult {
  readonly output: string;
  readonly truncated: boolean;
  readonly exit_code: number;
}

/** Parameters for {@link IRepoToolsPort.showArtifact}. */
export interface IShowArtifactParams {
  /** Run id whose `.aimo/runs/<run_id>/` directory is read from. */
  readonly run_id: string;
  /** Path relative to that run directory (not absolute). */
  readonly path: string;
  /** Max UTF-8 bytes to return; adapter default when omitted. */
  readonly max_bytes?: number | undefined;
}

/**
 * Repository tools invoked from the session loop (Phase 2+).
 * Implementations must enforce repo-root containment.
 */
export interface IRepoToolsPort {
  /**
   * Reads a text file under `repoRoot` (after `realpath` resolution).
   * @param repoRoot - Repository root (typically CLI cwd).
   * @param params - Path and optional byte cap.
   */
  readFile(repoRoot: string, params: IReadFileParams): Promise<IReadFileResult>;

  /**
   * Line-oriented regex search under `repoRoot` (skips dot-directories and common vendor trees).
   * @param repoRoot - Repository root (typically CLI cwd).
   * @param params - Pattern, optional glob, and caps.
   */
  grep(repoRoot: string, params: IGrepParams): Promise<IGrepResult>;

  /**
   * Depth-first file and directory listing under `repoRoot` (skips dot-entries and shared skip-dir set).
   * @param repoRoot - Repository root (typically CLI cwd).
   * @param params - Optional subtree root and caps.
   */
  listTree(repoRoot: string, params: IListTreeParams): Promise<IListTreeResult>;

  /**
   * Runs `git status --short -b` with `cwd` set to the resolved `repoRoot`.
   * @param repoRoot - Repository root (typically CLI cwd).
   * @param params - Optional output byte cap.
   */
  gitStatus(repoRoot: string, params?: IGitStatusParams): Promise<IGitStatusResult>;

  /**
   * Runs `git diff HEAD` or `git diff --cached` under the resolved `repoRoot`.
   * @param repoRoot - Repository root (typically CLI cwd).
   * @param params - Optional staged mode and output byte cap.
   */
  gitDiff(repoRoot: string, params?: IGitDiffParams): Promise<IGitDiffResult>;

  /**
   * Reads a text file under `.aimo/runs/<run_id>/` beneath `repoRoot` (after containment checks).
   * @param repoRoot - Repository root (typically CLI cwd).
   * @param params - Bound run id and relative artifact path.
   */
  showArtifact(repoRoot: string, params: IShowArtifactParams): Promise<IReadFileResult>;
}
