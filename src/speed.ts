// ============================================================
// ClaudeHub - 输出速度（tok/s）
// ============================================================
//
// 口径照搬 ccstatusline（github.com/sirmalloc/ccstatusline，MIT）：
//   每条 assistant 记录的生成区间 = [上一条 user 条目的时间戳, 本组末条 assistant 的时间戳]
//   把所有区间「合并重叠」后求总长，再用 Σ outputTokens ÷ 总长。
//   合并重叠是精髓：并发的 subagent 会让区间互相重叠，不合并就会重复计时。
//
// transcript 里没有请求发起时间，所以首字延迟（TTFT）在本方案中无法计算。

import { openSync, readSync, closeSync, statSync } from 'node:fs';

/** 只读 transcript 尾部这么多字节（足够喂满滑动窗口） */
export const SPEED_TAIL_BYTES = 1024 * 1024;

interface Interval {
  startMs: number;
  endMs: number;
}

interface SpeedRequest {
  outputTokens: number;
  lastTimestampMs: number | null;
  interval: Interval | null;
}

/** 解析单行 JSON，失败返回 null */
function parseLine(line: string): any {
  try { return JSON.parse(line); } catch { return null; }
}

/** 读取文件尾部若干字节（按行对齐，丢掉可能被截断的首行） */
function readTail(path: string, maxBytes: number): string[] {
  let size: number;
  try { size = statSync(path).size; } catch { return []; }
  if (size <= 0) return [];

  // maxBytes <= 0 表示读全文件（transcript 最大也就几 MB）
  const full = maxBytes <= 0 || size <= maxBytes;
  const length = full ? size : maxBytes;
  const offset = size - length;

  let text: string;
  try {
    const fd = openSync(path, 'r');
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, offset);
    closeSync(fd);
    text = buf.toString('utf-8');
  } catch {
    return [];
  }

  const lines = text.split('\n');
  // 不是从文件头读起时，首行可能被切了一半，丢掉
  if (offset > 0) lines.shift();
  return lines;
}

/** 合并重叠区间 */
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  const sorted = intervals.slice().sort((a, b) => a.startMs - b.startMs);
  const merged: Interval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * 扫描 transcript，按 windowSeconds 秒的滑动窗口计算输出速度
 * @param windowSeconds 0 = 整个（已读到的）会话，>0 = 距最后一条记录最近 N 秒
 */
export function getOutputSpeed(transcriptPath: string, rawWindowSeconds: number): number | null {
  if (!transcriptPath) return null;

  const windowSeconds = Math.max(0, Math.floor(rawWindowSeconds));
  // 滑动窗口只需尾部一段；全会话均值（0）必须读全文件 —— 尾部截断会把
  // 数字变成「尾部若干 MB 的均值」，那是另一个口径
  const lines = readTail(transcriptPath, windowSeconds > 0 ? SPEED_TAIL_BYTES : 0);
  if (lines.length === 0) return null;

  const requests: SpeedRequest[] = [];
  let lastUserTimestampMs: number | null = null;

  // 同一条 message.id 会写成多条记录（内容分块流式落盘），它们共享同一份
  // usage 和区间，所以按 id 去重，只保留该组最后一条
  const indexById = new Map<string, number>();

  for (const line of lines) {
    if (!line.trim()) continue;
    const entry = parseLine(line);
    if (!entry || entry.isApiErrorMessage) continue;

    const ts = entry.timestamp ? Date.parse(entry.timestamp) : null;
    const timestampMs = ts !== null && !Number.isNaN(ts) ? ts : null;

    if (entry.type === 'user') {
      if (timestampMs !== null) lastUserTimestampMs = timestampMs;
      continue;
    }

    if (entry.type !== 'assistant' || !entry.message?.usage) continue;

    let interval: Interval | null = null;
    if (timestampMs !== null && lastUserTimestampMs !== null && timestampMs > lastUserTimestampMs) {
      interval = { startMs: lastUserTimestampMs, endMs: timestampMs };
    }

    const request: SpeedRequest = {
      outputTokens: entry.message.usage.output_tokens ?? 0,
      lastTimestampMs: timestampMs,
      interval,
    };

    const id = entry.message?.id;
    if (typeof id === 'string' && id) {
      const existing = indexById.get(id);
      if (existing === undefined) {
        indexById.set(id, requests.length);
        requests.push(request);
      } else {
        requests[existing] = request;
      }
    } else {
      requests.push(request);
    }
  }

  if (requests.length === 0) return null;

  // 窗口终点取「已读到的最后一条记录」，而不是最后一条 assistant —— 后者在
  // 工具执行期间会停在过去，让窗口一直不滚动、数字卡住
  let latestTimestampMs: number | null = null;
  for (const request of requests) {
    if (request.lastTimestampMs !== null
      && (latestTimestampMs === null || request.lastTimestampMs > latestTimestampMs)) {
      latestTimestampMs = request.lastTimestampMs;
    }
  }
  for (const line of lines) {
    if (!line.trim()) continue;
    const entry = parseLine(line);
    const ts = entry?.timestamp ? Date.parse(entry.timestamp) : null;
    if (ts === null || Number.isNaN(ts)) continue;
    if (latestTimestampMs === null || ts > latestTimestampMs) latestTimestampMs = ts;
  }
  if (latestTimestampMs === null) return null;

  // 滑动窗口：以最后一条记录为终点，向前取 windowSeconds 秒
  const windowEndMs = windowSeconds > 0 ? latestTimestampMs : null;
  const windowStartMs = windowEndMs !== null ? windowEndMs - windowSeconds * 1000 : null;

  const selected = windowStartMs === null || windowEndMs === null
    ? requests
    : requests.filter((r) => r.lastTimestampMs !== null
        && r.lastTimestampMs >= windowStartMs
        && r.lastTimestampMs <= windowEndMs);

  let outputTokens = 0;
  const intervals: Interval[] = [];

  for (const request of selected) {
    outputTokens += request.outputTokens;
    if (!request.interval) continue;

    if (windowStartMs === null || windowEndMs === null) {
      intervals.push(request.interval);
      continue;
    }

    const start = Math.max(request.interval.startMs, windowStartMs);
    const end = Math.min(request.interval.endMs, windowEndMs);
    if (end > start) intervals.push({ startMs: start, endMs: end });
  }

  const totalDurationMs = mergeIntervals(intervals)
    .reduce((total, i) => total + (i.endMs - i.startMs), 0);

  if (totalDurationMs <= 0) return null;
  return outputTokens / (totalDurationMs / 1000);
}
