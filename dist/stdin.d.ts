import type { StdinData, UsageData, SessionTokenUsage } from './types.js';
/** 从 stdin 读取 Claude Code 传入的 JSON 数据 */
export declare function readStdin(): Promise<StdinData | null>;
/** 计算当前上下文使用的 token 数 */
export declare function getTotalTokens(stdin: StdinData): number;
/** 获取上下文使用百分比（优先使用 Claude Code 原生值） */
export declare function getContextPercent(stdin: StdinData): number;
/** 获取上下文窗口大小 */
export declare function getContextWindowSize(stdin: StdinData): number;
/** 获取模型显示名称 */
export declare function getModelName(stdin: StdinData): string;
/** 格式化时长：毫秒 → 人类可读字符串 */
export declare function formatDuration(ms: number): string;
/** 从 stdin 提取 session token 用量 */
export declare function getSessionTokens(stdin: StdinData): SessionTokenUsage | null;
/** 从 stdin 提取使用率数据 */
export declare function getUsageFromStdin(stdin: StdinData): UsageData | null;
/** 从 stdin 提取 effort 级别 */
export declare function getEffort(stdin: StdinData): string | null;
//# sourceMappingURL=stdin.d.ts.map