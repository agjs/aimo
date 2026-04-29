/**
 * @file RepoTools.fake.ts
 * @layer shared
 * @description In-memory {@link IRepoToolsPort} for tests.
 */

import type {
  IGrepParams,
  IGrepResult,
  IGitDiffParams,
  IGitDiffResult,
  IGitStatusParams,
  IGitStatusResult,
  IListTreeParams,
  IListTreeResult,
  IReadFileParams,
  IReadFileResult,
  IRepoToolsPort,
  IShowArtifactParams,
} from '@core/ports/IRepoToolsPort.types';

const DEFAULT_GREP: IGrepResult = {
  matches: [],
  truncated_matches: false,
  truncated_output: false,
  files_scanned: 0,
};

const DEFAULT_LIST_TREE: IListTreeResult = {
  lines: [],
  truncated_entries: false,
  truncated_output: false,
  dirs_visited: 0,
};

const DEFAULT_GIT_STATUS: IGitStatusResult = {
  output: '',
  truncated: false,
  exit_code: 0,
};

const DEFAULT_GIT_DIFF: IGitDiffResult = {
  output: '',
  truncated: false,
  exit_code: 0,
};

const DEFAULT_SHOW_ARTIFACT: IReadFileResult = {
  content: '',
  truncated: false,
  total_lines: 0,
};

/** Fixed results for {@link FakeRepoTools}. */
export interface TFakeRepoToolsConfig {
  readonly readFile: IReadFileResult;
  readonly grep?: IGrepResult;
  readonly listTree?: IListTreeResult;
  readonly gitStatus?: IGitStatusResult;
  readonly gitDiff?: IGitDiffResult;
  readonly showArtifact?: IReadFileResult;
}

/**
 * Returns fixed results for {@link IRepoToolsPort.readFile}, and optional repo-tool stubs.
 */
export class FakeRepoTools implements IRepoToolsPort {
  /**
   * @param cfg - Per-tool return values.
   */
  public constructor(private readonly cfg: TFakeRepoToolsConfig) {}

  /**
   * @inheritdoc
   */
  public readFile(_repoRoot: string, _params: IReadFileParams): Promise<IReadFileResult> {
    return Promise.resolve(this.cfg.readFile);
  }

  /**
   * @inheritdoc
   */
  public grep(_repoRoot: string, _params: IGrepParams): Promise<IGrepResult> {
    return Promise.resolve(this.cfg.grep ?? DEFAULT_GREP);
  }

  /**
   * @inheritdoc
   */
  public listTree(_repoRoot: string, _params: IListTreeParams): Promise<IListTreeResult> {
    return Promise.resolve(this.cfg.listTree ?? DEFAULT_LIST_TREE);
  }

  /**
   * @inheritdoc
   */
  public gitStatus(_repoRoot: string, _params?: IGitStatusParams): Promise<IGitStatusResult> {
    return Promise.resolve(this.cfg.gitStatus ?? DEFAULT_GIT_STATUS);
  }

  /**
   * @inheritdoc
   */
  public gitDiff(_repoRoot: string, _params?: IGitDiffParams): Promise<IGitDiffResult> {
    return Promise.resolve(this.cfg.gitDiff ?? DEFAULT_GIT_DIFF);
  }

  /**
   * @inheritdoc
   */
  public showArtifact(_repoRoot: string, _params: IShowArtifactParams): Promise<IReadFileResult> {
    return Promise.resolve(this.cfg.showArtifact ?? DEFAULT_SHOW_ARTIFACT);
  }
}
