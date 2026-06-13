// ============================================================
// ClaudeHub - ANSI 颜色和进度条
// ============================================================
import { USAGE_WARNING_THRESHOLD, USAGE_CRITICAL_THRESHOLD, } from '../constants.js';
export const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const BRIGHT_BLUE = '\x1b[94m';
const BRIGHT_MAGENTA = '\x1b[95m';
const ANSI_BY_NAME = {
    dim: DIM,
    red: RED,
    green: GREEN,
    yellow: YELLOW,
    magenta: MAGENTA,
    cyan: CYAN,
    brightBlue: BRIGHT_BLUE,
    brightMagenta: BRIGHT_MAGENTA,
};
function resolveAnsi(value, fallback) {
    if (!value)
        return fallback;
    if (ANSI_BY_NAME[value])
        return ANSI_BY_NAME[value];
    // 支持 256 色数字
    const num = Number(value);
    if (!Number.isNaN(num) && num >= 0 && num <= 255) {
        return `\x1b[38;5;${num}m`;
    }
    // 支持十六进制
    if (value.startsWith('#') && value.length === 7) {
        const r = parseInt(value.slice(1, 3), 16);
        const g = parseInt(value.slice(3, 5), 16);
        const b = parseInt(value.slice(5, 7), 16);
        return `\x1b[38;2;${r};${g};${b}m`;
    }
    return fallback;
}
function colorize(text, color) {
    return `${color}${text}${RESET}`;
}
// ---- 基础颜色函数 ----
export const dim = (t) => colorize(t, DIM);
export const red = (t) => colorize(t, RED);
export const green = (t) => colorize(t, GREEN);
export const yellow = (t) => colorize(t, YELLOW);
export const magenta = (t) => colorize(t, MAGENTA);
export const cyan = (t) => colorize(t, CYAN);
// ---- 可配置颜色 ----
export function model(text, colors) {
    return colorize(text, resolveAnsi(colors?.model, CYAN));
}
export function project(text, colors) {
    return colorize(text, resolveAnsi(colors?.project, YELLOW));
}
export function git(text, colors) {
    return colorize(text, resolveAnsi(colors?.git, MAGENTA));
}
export function gitBranch(text, colors) {
    return colorize(text, resolveAnsi(colors?.gitBranch, CYAN));
}
export function effort(text, colors) {
    return colorize(text, resolveAnsi(colors?.effort, MAGENTA));
}
// ---- Effort 颜色（按级别区分） ----
const EFFORT_DYNAMIC_COLORS = [
    '\x1b[35m', // magenta
    '\x1b[95m', // bright magenta
    '\x1b[38;5;93m', // purple (256-color)
    '\x1b[95m', // bright magenta
];
const ULTRACODE_DYNAMIC_COLORS = [
    '\x1b[35m', // magenta
    '\x1b[36m', // cyan
    '\x1b[32m', // green
    '\x1b[33m', // yellow
    '\x1b[95m', // bright magenta
    '\x1b[36m', // cyan
    '\x1b[32m', // green
    '\x1b[35m', // magenta
];
/** 根据 effort 级别获取颜色，支持动态循环效果 */
export function getEffortColor(level, colors) {
    // 用户自定义颜色优先
    if (colors?.effort) {
        return resolveAnsi(colors.effort, MAGENTA);
    }
    switch (level) {
        case 'low':
            return GREEN;
        case 'medium':
            return YELLOW;
        case 'xhigh':
        case 'high':
            return MAGENTA;
        case 'max': {
            // 基于时间动态循环 → 每 2 秒轮换一次颜色
            const idx = Math.floor(Date.now() / 2000) % EFFORT_DYNAMIC_COLORS.length;
            return EFFORT_DYNAMIC_COLORS[idx];
        }
        case 'ultracode': {
            // 多彩动态循环 → 每 1.5 秒轮换一次彩虹色
            const idx = Math.floor(Date.now() / 1500) % ULTRACODE_DYNAMIC_COLORS.length;
            return ULTRACODE_DYNAMIC_COLORS[idx];
        }
        default:
            return MAGENTA;
    }
}
/** 使用 effort 级别感知的彩色文本渲染 */
export function effortColored(text, level, colors) {
    return colorize(text, getEffortColor(level, colors));
}
export function label(text, colors) {
    return colorize(text, resolveAnsi(colors?.label, DIM));
}
export function warning(text, colors) {
    return colorize(text, resolveAnsi(colors?.warning, YELLOW));
}
export function critical(text, colors) {
    return colorize(text, resolveAnsi(colors?.critical, RED));
}
// ---- 上下文进度条颜色 ----
/**
 * 根据百分比返回平滑渐变的真彩色 (24-bit RGB)
 *
 * 渐变路径：绿 → 黄绿 → 金黄 → 橙 → 红
 * 完全控制 RGB 值，不依赖 256 色盘的离散索引，确保绝对平滑。
 *
 * 渐变节点：
 *   0%   rgb(0, 180, 0)   纯绿
 *   25%  rgb(80, 200, 0)  黄绿
 *   50%  rgb(200, 200, 0) 金黄
 *   70%  rgb(255, 160, 0) 橙色
 *   85%  rgb(255, 80, 0)  深橙
 *   100% rgb(220, 0, 0)   纯红
 */
function gradientColor(percent) {
    const stops = [
        { pct: 0, r: 0, g: 180, b: 0 },
        { pct: 25, r: 80, g: 200, b: 0 },
        { pct: 50, r: 200, g: 200, b: 0 },
        { pct: 70, r: 255, g: 160, b: 0 },
        { pct: 85, r: 255, g: 80, b: 0 },
        { pct: 100, r: 220, g: 0, b: 0 },
    ];
    // 找到当前百分比所在的区间
    let lower = stops[0];
    let upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
        if (percent >= stops[i].pct && percent <= stops[i + 1].pct) {
            lower = stops[i];
            upper = stops[i + 1];
            break;
        }
    }
    // 线性插值 RGB
    const range = upper.pct - lower.pct;
    const t = range === 0 ? 0 : (percent - lower.pct) / range;
    const r = Math.round(lower.r + (upper.r - lower.r) * t);
    const g = Math.round(lower.g + (upper.g - lower.g) * t);
    const b = Math.round(lower.b + (upper.b - lower.b) * t);
    return `\x1b[38;2;${r};${g};${b}m`;
}
export function getContextColor(percent, colors) {
    // 如果用户自定义了 context 颜色，尊重用户配置
    if (colors?.context) {
        return resolveAnsi(colors.context, GREEN);
    }
    // 使用真彩色平滑渐变
    return gradientColor(percent);
}
// ---- 使用率进度条颜色 ----
export function getQuotaColor(percent, colors) {
    if (percent >= USAGE_CRITICAL_THRESHOLD)
        return resolveAnsi(colors?.critical, RED);
    if (percent >= USAGE_WARNING_THRESHOLD)
        return resolveAnsi(colors?.usage, BRIGHT_MAGENTA);
    return resolveAnsi(colors?.usage, BRIGHT_BLUE);
}
// ---- 进度条渲染 ----
/**
 * 渲染一个彩色进度条
 * @param percent 0-100
 * @param width 进度条宽度（字符数）
 * @param colors 颜色配置
 */
export function coloredBar(percent, width = 10, colors) {
    const safeWidth = Math.max(0, Math.round(width));
    const safePercent = Math.min(100, Math.max(0, percent));
    const filled = Math.round((safePercent / 100) * safeWidth);
    const empty = safeWidth - filled;
    const color = getContextColor(safePercent, colors);
    return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}
/**
 * 渲染使用率进度条
 */
export function quotaBar(percent, width = 10, colors) {
    const safeWidth = Math.max(0, Math.round(width));
    const safePercent = Math.min(100, Math.max(0, percent));
    const filled = Math.round((safePercent / 100) * safeWidth);
    const empty = safeWidth - filled;
    const color = getQuotaColor(safePercent, colors);
    return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}
//# sourceMappingURL=colors.js.map