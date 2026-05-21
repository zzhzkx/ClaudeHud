// ============================================================
// ClaudeHub - Transcript 解析
// ============================================================

import { readFileSync } from 'node:fs';
import type { TranscriptData, ToolEntry, AgentEntry, TodoItem } from './types.js';

/**
 * 解析 Claude Code 的 transcript JSONL 文件
 * 提取工具调用、Agent 活动、待办事项等信息
 */
export function parseTranscript(transcriptPath: string): TranscriptData {
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
    // 文件可能正在被写入中，等待一下再重试一次
    try {
      const { setTimeout } = require('node:timers/promises');
      // 同步等待 50ms（用 busy wait 避免 async）
      const start = Date.now();
      while (Date.now() - start < 50) {}
      content = readFileSync(transcriptPath, 'utf-8');
    } catch {
      return result;
    }
  }

  const lines = content.split('\n').filter((l) => l.trim());

  const toolMap = new Map<string, ToolEntry>();
  const agentMap = new Map<string, AgentEntry>();
  const todoMap = new Map<string, TodoItem>();

  for (const line of lines) {
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const type = entry.type as string;

    // 会话开始时间
    if (type === 'session' && entry.timestamp) {
      result.sessionStart = new Date(entry.timestamp);
    }

    // 会话名称
    if (type === 'session' && entry.name) {
      result.sessionName = entry.name;
    }

    // 工具调用
    if (type === 'tool_use' && entry.tool_use) {
      const tu = entry.tool_use;
      const tool: ToolEntry = {
        id: tu.id ?? '',
        name: tu.name ?? 'unknown',
        target: tu.input?.file_path ?? tu.input?.path ?? tu.input?.pattern,
        status: 'running',
        startTime: new Date(entry.timestamp ?? Date.now()),
      };
      toolMap.set(tool.id, tool);
    }

    // 工具结果
    if (type === 'tool_result' && entry.tool_result) {
      const tr = entry.tool_result;
      const tool = toolMap.get(tr.tool_use_id ?? '');
      if (tool) {
        tool.status = tr.is_error ? 'error' : 'completed';
        tool.endTime = new Date(entry.timestamp ?? Date.now());
      }
    }

    // 子 Agent 启动
    if (type === 'agent_start' && entry.agent) {
      const agent: AgentEntry = {
        id: entry.agent.id ?? '',
        type: entry.agent.type ?? 'unknown',
        model: entry.agent.model,
        description: entry.agent.task ?? entry.agent.description,
        status: 'running',
        startTime: new Date(entry.timestamp ?? Date.now()),
      };
      agentMap.set(agent.id, agent);
    }

    // 子 Agent 完成
    if (type === 'agent_end' && entry.agent) {
      const agent = agentMap.get(entry.agent.id ?? '');
      if (agent) {
        agent.status = 'completed';
        agent.endTime = new Date(entry.timestamp ?? Date.now());
      }
    }

    // 待办事项
    if (type === 'todo' && entry.todo) {
      const todo = entry.todo;
      const key = todo.content ?? '';
      if (key) {
        todoMap.set(key, {
          content: key,
          status: todo.status ?? 'pending',
        });
      }
    }

    // 最后 assistant 响应时间
    if (type === 'assistant' && entry.timestamp) {
      result.lastAssistantResponseAt = new Date(entry.timestamp);
    }
  }

  // 只保留最近的工具调用（最多 20 个）
  result.tools = Array.from(toolMap.values()).slice(-20);
  result.agents = Array.from(agentMap.values());
  result.todos = Array.from(todoMap.values());

  return result;
}
