// ============================================================
// ClaudeHub - 核心类型定义
// ============================================================

/** Claude Code 通过 stdin 传入的 JSON 数据结构 */
export interface StdinData {
  transcript_path?: string;
  cwd?: string;
  workspace?: {
    current_dir?: string;
    project_dir?: string;
    added_dirs?: string[];
  } | null;
  model?: {
    id?: string;
    display_name?: string;
  };
  context_window?: {
    context_window_size?: number;
    total_input_tokens?: number | null;
    total_output_tokens?: number | null;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
    /** Claude Code v2.1.6+ 原生百分比 */
    used_percentage?: number | null;
    remaining_percentage?: number | null;
  };
  cost?: {
    total_cost_usd?: number | null;
    total_duration_ms?: number | null;
  } | null;
  rate_limits?: {
    five_hour?: {
      used_percentage?: number | null;
      resets_at?: number | null;
    } | null;
    seven_day?: {
      used_percentage?: number | null;
      resets_at?: number | null;
    } | null;
  } | null;
  effort?: string | { level?: string | null } | null;
}

/** 工具调用记录 */
export interface ToolEntry {
  id: string;
  name: string;
  target?: string;
  status: 'running' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
}

/** 子 Agent 记录 */
export interface AgentEntry {
  id: string;
  type: string;
  model?: string;
  description?: string;
  status: 'running' | 'completed';
  startTime: Date;
  endTime?: Date;
}

/** 待办事项 */
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/** 使用率数据 */
export interface UsageData {
  fiveHour: number | null;
  sevenDay: number | null;
  fiveHourResetAt: Date | null;
  sevenDayResetAt: Date | null;
}

/** 系统内存信息 */
export interface MemoryInfo {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
}

/** 会话 Token 用量 */
export interface SessionTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

/** Transcript 解析结果 */
export interface TranscriptData {
  tools: ToolEntry[];
  agents: AgentEntry[];
  todos: TodoItem[];
  sessionStart?: Date;
  sessionName?: string;
  lastAssistantResponseAt?: Date;
  sessionTokens?: SessionTokenUsage;
}

/** HUD 配置 */
export interface HudConfig {
  language: 'en' | 'zh';
  lineLayout: 'expanded' | 'compact';
  pathLevels: number;
  elementOrder: string[];
  gitStatus: {
    enabled: boolean;
    showDirty: boolean;
    showAheadBehind: boolean;
  };
  display: {
    showModel: boolean;
    showContextBar: boolean;
    contextValue: 'percent' | 'tokens' | 'remaining' | 'both';
    showTools: boolean;
    showAgents: boolean;
    showTodos: boolean;
    showUsage: boolean;
    usageBarEnabled: boolean;
    showDuration: boolean;
    showEffort: boolean;
    effortDisplayMap?: Record<string, string>;
    showCost: boolean;
    showMemoryUsage: boolean;
    showSessionTokens: boolean;
    timeFormat: 'relative' | 'absolute' | 'both';
  };
  colors: {
    context: string;
    usage: string;
    warning: string;
    critical: string;
    effort: string;
    model: string;
    project: string;
    git: string;
    gitBranch: string;
    label: string;
  };
}

/** 渲染上下文 —— 所有渲染函数共享的数据 */
export interface RenderContext {
  stdin: StdinData;
  transcript: TranscriptData;
  sessionDuration: string;
  usageData: UsageData | null;
  memoryUsage: MemoryInfo | null;
  config: HudConfig;
  gitBranch?: string;
  gitDirty?: boolean;
}

/** 默认配置 */
export const DEFAULT_CONFIG: HudConfig = {
  language: 'zh',
  lineLayout: 'expanded',
  pathLevels: 1,
  elementOrder: ['project', 'context', 'usage', 'tools', 'agents', 'todos'],
  gitStatus: {
    enabled: true,
    showDirty: true,
    showAheadBehind: false,
  },
  display: {
    showModel: true,
    showContextBar: true,
    contextValue: 'both',
    showTools: true,
    showAgents: false,
    showTodos: false,
    showUsage: true,
    usageBarEnabled: true,
    showDuration: true,
    showEffort: true,
    showCost: false,
    showMemoryUsage: false,
    showSessionTokens: true,
    timeFormat: 'relative',
  },
  colors: {
    context: 'green',
    usage: 'brightBlue',
    warning: 'yellow',
    critical: 'red',
    effort: 'magenta',
    model: 'cyan',
    project: 'yellow',
    git: 'magenta',
    gitBranch: 'cyan',
    label: 'dim',
  },
};
