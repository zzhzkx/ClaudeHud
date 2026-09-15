// ============================================================
// ClaudeHub - Transcript 解析
// ============================================================
import { readFileSync } from 'node:fs';
/** 解析单行 JSON，失败返回 null */
function parseLine(line) {
    try {
        return JSON.parse(line);
    }
    catch {
        return null;
    }
}
/**
 * 清洗文本：去掉换行/制表/控制字符
 * 状态栏是按行渲染的，文本里残留的换行会让物理行数与逻辑行数失配。
 */
function sanite(text) {
    if (!text)
        return '';
    return text.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
}
/** 把一批 JSONL 行累加进结果 */
function parseLines(lines, result) {
    const toolMap = new Map();
    const agentMap = new Map();
    const todoMap = new Map();
    for (const line of lines) {
        const entry = parseLine(line);
        if (!entry)
            continue;
        const type = entry.type;
        if (type === 'session' && entry.timestamp) {
            result.sessionStart = new Date(entry.timestamp);
        }
        if (type === 'session' && entry.name) {
            result.sessionName = sanite(entry.name);
        }
        // 如果没有 session 条目，用第一条用户消息时间作为会话开始
        if (!result.sessionStart && type === 'user' && entry.timestamp) {
            result.sessionStart = new Date(entry.timestamp);
        }
        if (type === 'tool_use' && entry.tool_use) {
            const tu = entry.tool_use;
            toolMap.set(tu.id ?? '', {
                id: tu.id ?? '',
                name: tu.name ?? 'unknown',
                target: sanite(tu.input?.file_path ?? tu.input?.path ?? tu.input?.pattern),
                status: 'running',
                startTime: new Date(entry.timestamp ?? Date.now()),
            });
        }
        if (type === 'tool_result' && entry.tool_result) {
            const tool = toolMap.get(entry.tool_result.tool_use_id ?? '');
            if (tool) {
                tool.status = entry.tool_result.is_error ? 'error' : 'completed';
                tool.endTime = new Date(entry.timestamp ?? Date.now());
            }
        }
        if (type === 'agent_start' && entry.agent) {
            agentMap.set(entry.agent.id ?? '', {
                id: entry.agent.id ?? '',
                type: entry.agent.type ?? 'unknown',
                model: entry.agent.model,
                description: sanite(entry.agent.task ?? entry.agent.description),
                status: 'running',
                startTime: new Date(entry.timestamp ?? Date.now()),
            });
        }
        if (type === 'agent_end' && entry.agent) {
            const agent = agentMap.get(entry.agent.id ?? '');
            if (agent) {
                agent.status = 'completed';
                agent.endTime = new Date(entry.timestamp ?? Date.now());
            }
        }
        if (type === 'todo' && entry.todo) {
            const key = sanite(entry.todo.content);
            if (key) {
                todoMap.set(key, { content: key, status: entry.todo.status ?? 'pending' });
            }
        }
        if (type === 'assistant' && entry.timestamp) {
            result.lastAssistantResponseAt = new Date(entry.timestamp);
        }
    }
    result.tools = Array.from(toolMap.values()).slice(-20);
    result.agents = Array.from(agentMap.values());
    result.todos = Array.from(todoMap.values());
}
/** 全量解析 transcript 文件 */
export function parseTranscript(transcriptPath) {
    const result = {
        tools: [],
        agents: [],
        todos: [],
    };
    if (!transcriptPath)
        return result;
    let content;
    try {
        content = readFileSync(transcriptPath, 'utf-8');
    }
    catch {
        return result;
    }
    parseLines(content.split('\n').filter((l) => l.trim()), result);
    return result;
}
//# sourceMappingURL=transcript.js.map