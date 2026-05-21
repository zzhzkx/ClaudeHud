// ============================================================
// ClaudeHub - Transcript 解析（增量读取优化）
// ============================================================

import { readFileSync, statSync } from 'node:fs';
import type { TranscriptData, ToolEntry, AgentEntry, TodoItem } from './types.js';

/** 解析单行 JSON，失败返回 null */
function parseLine(line: string): any {
  try { return JSON.parse(line); } catch { return null; }
}

/**
 * 从文件末尾增量读取新增行
 * 利用文件 size 变化判断是否有新内容，只解析新增部分
 */
export function parseTranscriptIncremental(
  transcriptPath: string,
  lastSize: number
): { data: TranscriptData; newSize: number } {
  const result: TranscriptData = {
    tools: [],
    agents: [],
    todos: [],
  };

  if (!transcriptPath) return { data: result, newSize: 0 };

  let stat;
  try { stat = statSync(transcriptPath); } catch { return { data: result, newSize: 0 }; }
  const newSize = stat.size;

  // 文件被清空或重置（比如新会话），全量读取
  if (newSize < lastSize) {
    return { data: parseTranscriptFull(transcriptPath), newSize };
  }

  // 没有新内容
  if (newSize === lastSize) {
    return { data: result, newSize };
  }

  // 只读取新增的字节
  try {
    const { openSync, readSync, closeSync } = require('node:fs');
    const fd = openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(newSize - lastSize);
    readSync(fd, buf, 0, buf.length, lastSize);
    closeSync(fd);

    const newContent = buf.toString('utf-8');
    const lines = newContent.split('\n').filter((l) => l.trim());

    const toolMap = new Map<string, ToolEntry>();
    const agentMap = new Map<string, AgentEntry>();
    const todoMap = new Map<string, TodoItem>();

    for (const line of lines) {
      const entry = parseLine(line);
      if (!entry) continue;

      const type = entry.type as string;

      if (type === 'session' && entry.timestamp) {
        result.sessionStart = new Date(entry.timestamp);
      }
      if (type === 'session' && entry.name) {
        result.sessionName = entry.name;
      }
      if (type === 'tool_use' && entry.tool_use) {
        const tu = entry.tool_use;
        toolMap.set(tu.id ?? '', {
          id: tu.id ?? '',
          name: tu.name ?? 'unknown',
          target: tu.input?.file_path ?? tu.input?.path ?? tu.input?.pattern,
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
          description: entry.agent.task ?? entry.agent.description,
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
        const key = entry.todo.content ?? '';
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
  } catch {
    // 增量读取失败，回退到全量
    return { data: parseTranscriptFull(transcriptPath), newSize };
  }

  return { data: result, newSize };
}

/** 全量解析 transcript 文件 */
function parseTranscriptFull(transcriptPath: string): TranscriptData {
  const result: TranscriptData = {
    tools: [],
    agents: [],
    todos: [],
  };

  if (!transcriptPath) return result;

  let content: string;
  try {
    content = readFileSync(transcriptPath, 'utf-8');
  } catch {
    return result;
  }

  const lines = content.split('\n').filter((l) => l.trim());
  const toolMap = new Map<string, ToolEntry>();
  const agentMap = new Map<string, AgentEntry>();
  const todoMap = new Map<string, TodoItem>();

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) continue;

    const type = entry.type as string;

    if (type === 'session' && entry.timestamp) {
      result.sessionStart = new Date(entry.timestamp);
    }
    if (type === 'session' && entry.name) {
      result.sessionName = entry.name;
    }
    if (type === 'tool_use' && entry.tool_use) {
      const tu = entry.tool_use;
      toolMap.set(tu.id ?? '', {
        id: tu.id ?? '',
        name: tu.name ?? 'unknown',
        target: tu.input?.file_path ?? tu.input?.path ?? tu.input?.pattern,
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
        description: entry.agent.task ?? entry.agent.description,
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
      const key = entry.todo.content ?? '';
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

  return result;
}

/** 兼容旧接口：全量解析 */
export function parseTranscript(transcriptPath: string): TranscriptData {
  return parseTranscriptFull(transcriptPath);
}
