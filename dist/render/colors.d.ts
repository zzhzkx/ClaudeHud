export declare const RESET = "\u001B[0m";
export declare const dim: (t: string) => string;
export declare const red: (t: string) => string;
export declare const green: (t: string) => string;
export declare const yellow: (t: string) => string;
export declare const magenta: (t: string) => string;
export declare const cyan: (t: string) => string;
export declare function model(text: string, colors?: Record<string, string>): string;
export declare function project(text: string, colors?: Record<string, string>): string;
export declare function git(text: string, colors?: Record<string, string>): string;
export declare function gitBranch(text: string, colors?: Record<string, string>): string;
export declare function effort(text: string, colors?: Record<string, string>): string;
/** 根据 effort 级别获取颜色，支持动态循环效果 */
export declare function getEffortColor(level: string, colors?: Record<string, string>): string;
/** 使用 effort 级别感知的彩色文本渲染 */
export declare function effortColored(text: string, level: string, colors?: Record<string, string>): string;
export declare function label(text: string, colors?: Record<string, string>): string;
export declare function warning(text: string, colors?: Record<string, string>): string;
export declare function critical(text: string, colors?: Record<string, string>): string;
export declare function getContextColor(percent: number, colors?: Record<string, string>): string;
export declare function getQuotaColor(percent: number, colors?: Record<string, string>): string;
/**
 * 渲染一个彩色进度条
 * @param percent 0-100
 * @param width 进度条宽度（字符数）
 * @param colors 颜色配置
 */
export declare function coloredBar(percent: number, width?: number, colors?: Record<string, string>): string;
/**
 * 渲染使用率进度条
 */
export declare function quotaBar(percent: number, width?: number, colors?: Record<string, string>): string;
//# sourceMappingURL=colors.d.ts.map