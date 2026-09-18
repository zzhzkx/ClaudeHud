import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const settingsPath = join(homedir(), '.claude', 'settings.json');

let config = {};
try {
  const raw = readFileSync(settingsPath, 'utf-8');
  config = JSON.parse(raw);
} catch {
  console.error('Could not read settings.json, creating new one');
}

// Use object format (official Claude Code format)
config.statusLine = {
  type: 'command',
  command: 'F:/claude_project/ClaudeHud/hud-rs/target/release/claudehub.exe',
  refreshInterval: 1,
};

writeFileSync(settingsPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
console.log('statusLine added to', settingsPath);
console.log(JSON.stringify(config.statusLine, null, 2));
