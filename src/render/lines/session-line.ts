// ============================================================
// ClaudeHub - 会话信息行渲染（模型 + 项目 + Git）
// ============================================================

import type { RenderContext } from '../../types.js';
import { model, project, git, gitBranch, label, dim } from '../colors.js';
import { getModelName } from '../../stdin.js';

/** 渲染会话信息行：模型 | 项目路径 | git 分支 */
export function renderSessionLine(ctx: RenderContext): string {
  const parts: string[] = [];
  const colors = ctx.config?.colors;
  const display = ctx.config?.display;

  // 模型名称 🤖
  if (display?.showModel !== false) {
    const modelName = getModelName(ctx.stdin);
    parts.push(model(`🤖 [${modelName}]`, colors));
  }

  // 项目路径 📁
  const projectDir = ctx.stdin.cwd || ctx.stdin.workspace?.current_dir || '';
  if (projectDir) {
    const depth = ctx.config?.pathLevels ?? 1;
    const segments = projectDir.replace(/\\/g, '/').split('/').filter(Boolean);
    const shortPath = segments.slice(-depth).join('/');
    parts.push(project(`📁 ${shortPath}`, colors));
  }

  // Git 分支 🌿
  if (ctx.config?.gitStatus?.enabled && ctx.gitBranch) {
    const dirty = ctx.gitDirty && ctx.config.gitStatus.showDirty ? ' ●' : '';
    const branchStr = `🌿 ${gitBranch(ctx.gitBranch, colors)}${dirty}`;
    parts.push(branchStr);
  }

  return parts.join(' │ ');
}
