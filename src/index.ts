#!/usr/bin/env node

// ============================================================
// ClaudeHub - Claude Code HUD 状态栏
// ============================================================

import { readStdin, getUsageFromStdin } from './stdin.js';
import { parseTranscriptIncremental } from './transcript.js';
import { loadConfig } from './config.js';
import { getGitStatus } from './git.js';
import { render } from './render/index.js';
import type { RenderContext, TranscriptData } from './types.js';

// ---- 缓存 ----

let cachedConfig: ReturnType<typeof loadConfig> | null = null;
let cachedGit: { branch: string; dirty: boolean; ts: number } | null = null;
let cachedTranscript: TranscriptData | null = null;
let transcriptLastSize = 0;

const GIT_CACHE_MS = 10000;       // Git 状态缓存 10 秒
const TRANSCRIPT_FULL_INTERVAL = 30000; // 每 30 秒强制全量解析一次（兜底）
let lastFullParse = 0;

function getConfig() {
  if (!cachedConfig) cachedConfig = loadConfig();
  return cachedConfig;
}

function getGitCached(cwd?: string) {
  const now = Date.now();
  if (cachedGit && now - cachedGit.ts < GIT_CACHE_MS) return cachedGit;
  const info = getGitStatus(cwd);
  cachedGit = { branch: info.branch, dirty: info.dirty, ts: now };
  return cachedGit;
}

async function main(): Promise<void> {
  try {
    const stdin = await readStdin();
    if (!stdin) return;

    const config = getConfig();
    const now = Date.now();

    // 增量解析 transcript：只读新增内容，大幅减少 I/O
    const forceFull = now - lastFullParse > TRANSCRIPT_FULL_INTERVAL;
    if (forceFull) {
      // 强制全量（兜底，防止增量累积误差）
      const { parseTranscript } = await import('./transcript.js');
      cachedTranscript = parseTranscript(stdin.transcript_path ?? '');
      try {
        const { statSync } = require('node:fs');
        transcriptLastSize = statSync(stdin.transcript_path ?? '').size;
      } catch { transcriptLastSize = 0; }
      lastFullParse = now;
    } else {
      // 增量解析
      const result = parseTranscriptIncremental(
        stdin.transcript_path ?? '',
        transcriptLastSize
      );
      transcriptLastSize = result.newSize;
      // 合并增量结果到缓存
      if (result.data.tools.length > 0) {
        cachedTranscript = { ...(cachedTranscript ?? { tools: [], agents: [], todos: [] }), ...result.data };
      }
      if (!cachedTranscript) {
        cachedTranscript = { tools: [], agents: [], todos: [] };
      }
    }

    const gitInfo = config.gitStatus?.enabled
      ? getGitCached(stdin.cwd)
      : { branch: '', dirty: false };

    const usageData = config.display?.showUsage !== false
      ? getUsageFromStdin(stdin)
      : null;

    const ctx: RenderContext = {
      stdin,
      transcript: cachedTranscript!,
      sessionDuration: '',
      usageData,
      memoryUsage: null,
      config,
      gitBranch: gitInfo.branch,
      gitDirty: gitInfo.dirty,
    };

    render(ctx);
  } catch {
    // 静默失败
  }
}

void main();
