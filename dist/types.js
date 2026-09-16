// ============================================================
// ClaudeHub - 核心类型定义
// ============================================================
/** 默认配置 */
export const DEFAULT_CONFIG = {
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
        showSpeed: true,
        speedWindow: 30,
        showSessionTokens: true,
        timeFormat: 'relative',
        maxLines: 0,
    },
    colors: {
        context: 'gradient',
        usage: 'brightBlue',
        warning: 'yellow',
        critical: 'red',
        effort: 'auto',
        model: 'cyan',
        project: 'yellow',
        git: 'magenta',
        gitBranch: 'cyan',
        label: 'dim',
    },
};
//# sourceMappingURL=types.js.map