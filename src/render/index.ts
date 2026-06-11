// ============================================================
// ClaudeHub - 渲染器主入口
// ============================================================

import type { RenderContext } from '../types.js';
import { renderSessionLine } from './lines/session-line.js';
import { renderContextLine } from './lines/context-line.js';
import { renderUsageLine } from './lines/usage.js';
import { renderToolsLine } from './lines/tools-line.js';
import { renderAgentsLine } from './lines/agents-line.js';
import { renderTodosLine } from './lines/todos-line.js';
import { renderSessionTokensLine } from './lines/session-tokens-line.js';
import { renderEffortLine } from './lines/effort.js';

/**
 * 渲染完整的 HUD 输出
 * 返回多行字符串，每行对应状态栏的一行
 */
export function render(ctx: RenderContext): string {
  const lines: string[] = [];
  const layout = ctx.config?.lineLayout ?? 'expanded';

  if (layout === 'compact') {
    // 紧凑模式：单行显示核心信息
    const parts: string[] = [];

    const sessionLine = renderSessionLine(ctx);
    if (sessionLine) parts.push(sessionLine);

    const contextLine = renderContextLine(ctx);
    if (contextLine) parts.push(contextLine);

    const usageLine = renderUsageLine(ctx);
    if (usageLine) parts.push(usageLine);

    if (parts.length > 0) {
      lines.push(parts.join(' │ '));
    }
  } else {
    // 展开模式：多行显示

    // 第 1 行：模型 | 项目 | Git
    const sessionLine = renderSessionLine(ctx);
    if (sessionLine) lines.push(sessionLine);

    // 第 2 行：上下文进度条 | 使用率
    const contextParts: string[] = [];
    const contextLine = renderContextLine(ctx);
    if (contextLine) contextParts.push(contextLine);
    const usageLine = renderUsageLine(ctx);
    if (usageLine) contextParts.push(usageLine);
    const effortLine = renderEffortLine(ctx);
    if (effortLine) contextParts.push(effortLine);
    if (contextParts.length > 0) {
      lines.push(contextParts.join(' │ '));
    }

    // 第 3 行（可选）：工具活动
    const toolsLine = renderToolsLine(ctx);
    if (toolsLine) lines.push(toolsLine);

    // 第 4 行（可选）：Agent 活动
    const agentsLine = renderAgentsLine(ctx);
    if (agentsLine) lines.push(agentsLine);

    // 第 5 行（可选）：待办进度
    const todosLine = renderTodosLine(ctx);
    if (todosLine) lines.push(todosLine);

    // 第 6 行（可选）：Session Token 用量
    const sessionTokensLine = renderSessionTokensLine(ctx);
    if (sessionTokensLine) lines.push(sessionTokensLine);
  }

  const output = lines.join('\n');
  console.log(output);
  return output;
}
