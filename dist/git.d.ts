export interface GitInfo {
    branch: string;
    dirty: boolean;
    ahead: number;
    behind: number;
}
/**
 * 获取当前目录的 Git 状态
 * `git status --short --branch` 一次就同时给出分支、脏状态、领先/落后，
 * 所以不必再分别跑 `git branch` / `git status` / `git rev-list`。
 */
export declare function getGitStatus(cwd?: string): GitInfo;
//# sourceMappingURL=git.d.ts.map