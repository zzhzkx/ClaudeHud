#!/usr/bin/env node
// ============================================================
// ClaudeHub - Claude Code HUD 状态栏
// ============================================================
import { readStdin, getUsageFromStdin, formatDuration } from './stdin.js';
import { parseTranscript } from './transcript.js';
import { loadConfig } from './config.js';
import { getGitStatus } from './git.js';
import { render } from './render/index.js';
function logError(msg, err) {
    // 输出到 stderr，不影响 stdout 的 HUD 渲染
    const detail = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[claudehub] ${msg}: ${detail}\n`);
}
async function main() {
    try {
        const stdin = await readStdin();
        if (!stdin)
            return;
        const config = loadConfig();
        const transcript = parseTranscript(stdin.transcript_path ?? '');
        const gitInfo = config.gitStatus?.enabled
            ? getGitStatus(stdin.cwd)
            : { branch: '', dirty: false };
        const usageData = config.display?.showUsage !== false
            ? getUsageFromStdin(stdin)
            : null;
        // 计算会话时长
        const sessionStart = transcript.sessionStart;
        const sessionDuration = sessionStart
            ? formatDuration(Date.now() - sessionStart.getTime())
            : '';
        const ctx = {
            stdin,
            transcript,
            sessionDuration,
            usageData,
            config,
            gitBranch: gitInfo.branch,
            gitDirty: gitInfo.dirty,
        };
        render(ctx);
    }
    catch (err) {
        logError('render failed', err);
    }
}
void main();
//# sourceMappingURL=index.js.map