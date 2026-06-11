// ============================================================
// ClaudeHub - Effort 级别行渲染
// ============================================================

import type { RenderContext } from '../../types.js';
import { label, effort as effortColor } from '../colors.js';
import { getEffort } from '../../stdin.js';

/** 渲染 effort 级别 */
export function renderEffortLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (display?.showEffort === false) return null;

  const level = getEffort(ctx.stdin);
  if (!level) return null;

  const colors = ctx.config?.colors;
  return `${label('⚡', colors)} ${effortColor(level, colors)}`;
}
