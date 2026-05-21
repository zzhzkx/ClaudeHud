#!/usr/bin/env node

// ============================================================
// ClaudeHub - Claude Code HUD 状态栏
//
// 一个为 Claude Code CLI 提供实时状态栏的 Node.js 工具
// 显示：模型名称、上下文使用进度条、工具活动、Git 状态等
//
// 灵感来自 jarrodwatts/claude-hud (MIT License)
// ============================================================

import { readStdin, getContextPercent, getModelName, getUsageFromStdin } from './stdin.js';
import { parseTranscript } from './transcript.js';
import { loadConfig } from './config.js';
import { getGitStatus } from './git.js';
import { render } from './render/index.js';
import type { RenderContext } from './types.js';

// ---- 缓存，避免每次触发都重新计算不变的数据 ----

let cachedConfig: ReturnType<typeof loadConfig> | null = null;
let cachedGit: { branch: string; dirty: boolean; ts: number } | null = null;
let cachedTranscript: { data: ReturnType<typeof parseTranscript>; ts: number; path: string } | null = null;

const GIT_CACHE_MS = 5000;      // Git 状态缓存 5 秒
const TRANSCRIPT_CACHE_MS = 3000; // Transcript 缓存 3 秒

function getConfig() {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

function getGitCached(cwd?: string) {
  const now = Date.now();
  if (cachedGit && now - cachedGit.ts < GIT_CACHE_MS) {
    return cachedGit;
  }
  const info = getGitStatus(cwd);
  cachedGit = { branch: info.branch, dirty: info.dirty, ts: now };
  return cachedGit;
}

function getTranscriptCached(path: string) {
  const now = Date.now();
  if (cachedTranscript && cachedTranscript.path === path && now - cachedTranscript.ts < TRANSCRIPT_CACHE_MS) {
    return cachedTranscript.data;
  }
  const data = parseTranscript(path);
  cachedTranscript = { data, ts: now, path };
  return data;
}

async function main(): Promise<void> {
  try {
    // 1. 从 stdin 读取 Claude Code 传入的数据
    const stdin = await readStdin();

    if (!stdin) {
      console.log('ClaudeHub - Claude Code HUD 状态栏');
      console.log('此工具应由 Claude Code 的 statusLine 配置调用');
      return;
    }

    // 2. 加载配置（缓存）
    const config = getConfig();

    // 3. 解析 transcript（缓存，避免频繁读取大文件）
    const transcript = getTranscriptCached(stdin.transcript_path ?? '');

    // 4. 获取 Git 状态（缓存，避免频繁执行 git 命令）
    const gitInfo = config.gitStatus?.enabled
      ? getGitCached(stdin.cwd)
      : { branch: '', dirty: false };

    // 5. 获取使用率数据
    const usageData = config.display?.showUsage !== false
      ? getUsageFromStdin(stdin)
      : null;

    // 6. 构建渲染上下文
    const ctx: RenderContext = {
      stdin,
      transcript,
      sessionDuration: '',
      usageData,
      memoryUsage: null,
      config,
      gitBranch: gitInfo.branch,
      gitDirty: gitInfo.dirty,
    };

    // 7. 渲染并输出
    render(ctx);
  } catch (error) {
    // 静默失败——不要让状态栏错误干扰 Claude Code
  }
}

void main();
