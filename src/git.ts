// ============================================================
// ClaudeHub - Git 状态获取
// ============================================================

import { execSync } from 'node:child_process';

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
export function getGitStatus(cwd?: string): GitInfo {
  const baseOpts = cwd ? { cwd } : {};

  let out: string;
  try {
    out = execSync('git status --short --branch', {
      ...baseOpts,
      encoding: 'utf-8',
      timeout: 3000,
    });
  } catch {
    // 不在 git 仓库中或 git 不可用
    return { branch: '', dirty: false, ahead: 0, behind: 0 };
  }

  const lines = out.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { branch: '', dirty: false, ahead: 0, behind: 0 };

  const header = lines[0];
  return {
    branch: parseBranch(header),
    dirty: lines.length > 1,
    ahead: parseCount(header, 'ahead'),
    behind: parseCount(header, 'behind'),
  };
}

/** 从 `## main...origin/main [ahead 1, behind 2]` 里取分支名 */
function parseBranch(header: string): string {
  let rest = header.trim();
  if (rest.startsWith('##')) rest = rest.slice(2);
  rest = rest.trim();
  if (!rest) return '';

  const dotIdx = rest.indexOf('...');
  if (dotIdx > 0) rest = rest.slice(0, dotIdx);

  const spaceIdx = rest.indexOf(' ');
  if (spaceIdx > 0) rest = rest.slice(0, spaceIdx);

  const name = rest.trim();
  if (!name || name === 'HEAD' || name.startsWith('No commits')) return '';
  return name;
}

/** 从头部行里取 `[ahead N]` / `[behind N]` 的计数 */
function parseCount(header: string, key: string): number {
  const open = header.indexOf(`[${key} `);
  if (open === -1) return 0;

  const rest = header.slice(open + key.length + 2);
  let digits = '';
  for (const ch of [...rest]) {
    if (ch >= '0' && ch <= '9') digits += ch;
    else break;
  }
  return digits ? Number(digits) : 0;
}
