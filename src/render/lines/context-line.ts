// ============================================================
// ClaudeHub - 上下文使用行渲染
// ============================================================

import type { RenderContext } from '../../types.js';
import { label, coloredBar, getContextColor, RESET } from '../colors.js';
import { getContextPercent, getContextWindowSize, getTotalTokens } from '../../stdin.js';

/** 格式化 token 数量 */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}

/** 渲染上下文使用行 */
export function renderContextLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (display?.showContextBar === false) return null;

  const colors = ctx.config?.colors;
  const percent = getContextPercent(ctx.stdin);
  const ctxLabel = label('上下文', colors);

  // 进度条
  const bar = coloredBar(percent, 10, colors);

  // 数值显示
  const mode = display?.contextValue ?? 'percent';
  const size = getContextWindowSize(ctx.stdin);
  const used = getTotalTokens(ctx.stdin);

  let valueStr: string;
  switch (mode) {
    case 'tokens':
      valueStr = `${formatTokens(used)}/${formatTokens(size)}`;
      break;
    case 'remaining':
      valueStr = `${100 - percent}%`;
      break;
    case 'both':
      valueStr = `${percent}% (${formatTokens(used)}/${formatTokens(size)})`;
      break;
    case 'percent':
    default:
      valueStr = `${percent}%`;
      break;
  }

  return `${ctxLabel} ${bar} ${valueStr}`;
}
