// ============================================================
// ClaudeHub - 输出速度行渲染
// ============================================================

import type { RenderContext } from '../../types.js';
import { label, cyan, dim } from '../colors.js';

/** 格式化速度值 */
function formatSpeed(tps: number): string {
  if (tps >= 1000) return `${(tps / 1000).toFixed(1)}k t/s`;
  return `${tps.toFixed(1)} t/s`;
}

/**
 * 渲染输出速度
 *
 * 窗口内没有任何生成活动时（用户在打字、工具在跑）显示占位符，
 * 而不是整行消失 —— 消失的读数会让人以为功能坏了。
 */
export function renderSpeedLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (display?.showSpeed !== true) return null;

  const colors = ctx.config?.colors;
  const tps = ctx.outputSpeed;

  if (tps !== null && Number.isFinite(tps) && tps > 0) {
    return `${label('🚀', colors)} ${cyan(formatSpeed(tps))}`;
  }
  return `${label('🚀', colors)} ${dim('— t/s')}`;
}
