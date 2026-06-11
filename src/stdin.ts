// ============================================================
// ClaudeHub - stdin 读取和解析
// ============================================================

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import type { StdinData, UsageData, SessionTokenUsage } from './types.js';
import { DEFAULT_CONTEXT_WINDOW, CONTEXT_WINDOW_SIZES } from './constants.js';

// ---- ccswitch 模型名称映射 ----

let cachedModelNameMap: Record<string, string> | null = null;

/** 从 settings.json 读取 ccswitch 模型名称映射 */
function getModelNameMap(): Record<string, string> {
  if (cachedModelNameMap !== null) return cachedModelNameMap;

  const paths = [
    `${homedir()}/.claude/settings.json`,
    `${homedir()}/.claude.json`,
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const settings = JSON.parse(readFileSync(p, 'utf-8')) as { env?: Record<string, string> };
      const env = settings.env;
      if (!env) continue;
      const map: Record<string, string> = {};
      // 匹配 ANTHROPIC_DEFAULT_*_MODEL 和对应的 _MODEL_NAME
      for (const [key, value] of Object.entries(env)) {
        const m = key.match(/^ANTHROPIC_DEFAULT_([A-Z]+)_MODEL$/i);
        if (m && typeof value === 'string') {
          const nameKey = `${key}_NAME`;
          const name = env[nameKey];
          if (typeof name === 'string') {
            map[value.toLowerCase()] = name;
          }
        }
      }
      if (Object.keys(map).length > 0) {
        cachedModelNameMap = map;
        return map;
      }
    } catch { /* ignore */ }
  }
  cachedModelNameMap = {};
  return cachedModelNameMap;
}

// ---- stdin 读取 ----

/** 从 stdin 读取 Claude Code 传入的 JSON 数据 */
export async function readStdin(): Promise<StdinData | null> {
  if (process.stdin.isTTY) return null;

  return new Promise<StdinData | null>((resolve) => {
    let raw = '';
    let settled = false;

    const finish = (value: StdinData | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);
      process.stdin.off('error', onError);
      process.stdin.pause();
      resolve(value);
    };

    const tryParse = (): StdinData | null => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      try {
        return JSON.parse(trimmed) as StdinData;
      } catch {
        const lines = trimmed.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (!line) continue;
          try { return JSON.parse(line) as StdinData; } catch { continue; }
        }
        return null;
      }
    };

    const onData = (chunk: string | Buffer) => { raw += String(chunk); };
    const onEnd = () => { finish(tryParse()); };
    const onError = () => { finish(tryParse()); };
    const timer = setTimeout(() => { finish(tryParse()); }, 3000);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);
  });
}

// ---- Token 计算 ----

/** 计算当前上下文使用的 token 数 */
export function getTotalTokens(stdin: StdinData): number {
  const usage = stdin.context_window?.current_usage;
  return (
    (usage?.input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0)
  );
}

/** 获取上下文使用百分比（优先使用 Claude Code 原生值） */
export function getContextPercent(stdin: StdinData): number {
  const native = stdin.context_window?.used_percentage;
  if (typeof native === 'number' && !Number.isNaN(native) && native > 0) {
    return Math.min(100, Math.max(0, Math.round(native)));
  }
  const size = getContextWindowSize(stdin);
  const total = getTotalTokens(stdin);
  if (size <= 0) return 0;
  return Math.min(100, Math.round((total / size) * 100));
}

/** 获取上下文窗口大小 */
export function getContextWindowSize(stdin: StdinData): number {
  const reported = stdin.context_window?.context_window_size;
  if (reported && reported > 0) return reported;
  const modelId = stdin.model?.id?.toLowerCase() ?? '';
  for (const [key, size] of Object.entries(CONTEXT_WINDOW_SIZES)) {
    if (modelId.includes(key)) return size;
  }
  return DEFAULT_CONTEXT_WINDOW;
}

// ---- 模型名称 ----

/** 获取模型显示名称 */
export function getModelName(stdin: StdinData): string {
  const modelId = stdin.model?.id?.trim() ?? '';
  const displayName = stdin.model?.display_name?.trim();

  // 1. 优先使用 ccswitch 映射的名称（从 settings.json 读取）
  const nameMap = getModelNameMap();
  if (nameMap) {
    const idLower = modelId.toLowerCase();
    // 精确匹配 model.id
    if (nameMap[idLower]) return nameMap[idLower];
    // 模糊匹配
    for (const [key, name] of Object.entries(nameMap)) {
      if (idLower.includes(key)) return name;
    }
  }

  // 2. 使用 Claude Code 原生的 display_name
  if (displayName) return displayName;

  if (!modelId) return 'Unknown';

  // 3. 从模型 ID 中提取可读名称
  const lower = modelId.toLowerCase();

  if (lower.includes('anthropic.claude-')) return normalizeBedrockModel(modelId);
  if (modelId.includes('@')) return normalizeModelId(modelId.split('@')[0]);

  return normalizeModelId(modelId);
}

/** 格式化 Bedrock 模型名称 */
function normalizeBedrockModel(modelId: string): string {
  const lower = modelId.toLowerCase();
  const prefix = 'anthropic.claude-';
  const idx = lower.indexOf(prefix);
  if (idx === -1) return modelId;

  let suffix = lower.slice(idx + prefix.length);
  suffix = suffix.replace(/-v\d+:\d+$/, '');
  suffix = suffix.replace(/-\d{8}$/, '');

  const tokens = suffix.split('-').filter(Boolean);
  const familyIdx = tokens.findIndex(
    (t) => t === 'haiku' || t === 'sonnet' || t === 'opus'
  );
  if (familyIdx === -1) return modelId;

  const family = tokens[familyIdx];
  const versionTokens: string[] = [];
  for (let i = familyIdx + 1; i < tokens.length && versionTokens.length < 2; i++) {
    if (/^\d+$/.test(tokens[i])) versionTokens.push(tokens[i]);
  }
  const version = versionTokens.length ? versionTokens.join('.') : null;
  const label = family[0].toUpperCase() + family.slice(1);
  return version ? `Claude ${label} ${version}` : `Claude ${label}`;
}

/** 格式化通用模型 ID */
function normalizeModelId(modelId: string): string {
  const spaced = modelId.replace(/-/g, ' ');
  const titled = spaced.replace(/\b\w/g, (c: string) => c.toUpperCase());
  return titled.replace(/(\d+)\s+(?=\d)/g, '$1.');
}

// ---- 时长 ----

/** 格式化时长：毫秒 → 人类可读字符串 */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const m = minutes % 60;
    return m > 0 ? `${hours}h ${m}m` : `${hours}h`;
  }
  if (minutes > 0) {
    const s = seconds % 60;
    return s > 0 ? `${minutes}m ${s}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

// ---- Session Tokens ----

/** 从 stdin 提取 session token 用量 */
export function getSessionTokens(stdin: StdinData): SessionTokenUsage | null {
  const usage = stdin.context_window?.current_usage;
  if (!usage) return null;

  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  if (input === 0 && output === 0) return null;

  return { inputTokens: input, outputTokens: output, cacheCreationTokens: cacheWrite, cacheReadTokens: cacheRead };
}

// ---- 使用率 ----

/** 从 stdin 提取使用率数据 */
export function getUsageFromStdin(stdin: StdinData): UsageData | null {
  const rateLimits = stdin.rate_limits;
  if (!rateLimits) return null;

  const fiveHour = rateLimits.five_hour?.used_percentage ?? null;
  const sevenDay = rateLimits.seven_day?.used_percentage ?? null;

  if (fiveHour === null && sevenDay === null) return null;

  return {
    fiveHour: typeof fiveHour === 'number' ? Math.round(fiveHour) : null,
    sevenDay: typeof sevenDay === 'number' ? Math.round(sevenDay) : null,
    fiveHourResetAt: rateLimits.five_hour?.resets_at
      ? new Date(rateLimits.five_hour.resets_at * 1000)
      : null,
    sevenDayResetAt: rateLimits.seven_day?.resets_at
      ? new Date(rateLimits.seven_day.resets_at * 1000)
      : null,
  };
}

// ---- Effort ----

/** 从 stdin 提取 effort 级别 */
export function getEffort(stdin: StdinData): string | null {
  const effort = stdin.effort;
  if (!effort) return null;
  if (typeof effort === 'string') return effort;
  return effort.level ?? null;
}
