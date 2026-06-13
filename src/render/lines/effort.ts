// ============================================================
// ClaudeHub - Effort 级别行渲染
// ============================================================

import type { RenderContext } from '../../types.js';
import { label, effortColored } from '../colors.js';
import { getEffort } from '../../stdin.js';

/** 渲染 effort 级别 */
export function renderEffortLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (display?.showEffort === false) return null;

  const rawLevel = getEffort(ctx.stdin);
  if (!rawLevel) return null;

  // 应用映射：如 raw=xhigh → display=ultracode，普通情况直接使用原始值
  const displayMap = display?.effortDisplayMap;
  const displayLevel = displayMap?.[rawLevel] ?? rawLevel;

  const colors = ctx.config?.colors;
  return `${label('⚡', colors)} ${effortColored(displayLevel, rawLevel, colors)}`;
}
