// ============================================================
// ClaudeHub - 输出速度行渲染
// ============================================================

import type { RenderContext } from '../../types.js';
import { label, cyan } from '../colors.js';

/** 格式化速度值 */
function formatSpeed(tps: number): string {
  if (tps >= 1000) return `${(tps / 1000).toFixed(1)}k t/s`;
  return `${tps.toFixed(1)} t/s`;
}

/** 渲染输出速度 */
export function renderSpeedLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (display?.showSpeed !== true) return null;

  const tps = ctx.outputSpeed;
  if (tps === null || !Number.isFinite(tps) || tps <= 0) return null;

  const colors = ctx.config?.colors;
  return `${label('🚀', colors)} ${cyan(formatSpeed(tps))}`;
}
