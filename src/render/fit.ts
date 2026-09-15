// ============================================================
// ClaudeHub - 状态栏宽度自适应
// ============================================================
//
// 状态栏的任何一行如果超过终端列宽，终端会把它折成两行，
// 而 Claude Code 按“逻辑行”做光标记账，于是后续重绘就会错位错乱
// （Claude Code 2.1.141 修过一版：多行状态栏任一行超宽会丢行/错乱）。
// 这里从 Claude Code 注入的环境变量 COLUMNS 拿到终端列宽，自己把每行
// 裁到列宽以内，从源头消掉折行。

import { RESET } from './colors.js';

/** ANSI 转义序列（本项目只输出 CSI SGR 形式） */
const ANSI_SGR_RE = /\x1b\[[0-9;]*m/g;

/** 全宽（双列）字符范围：假名、韩文、CJK、全角形 */
const FULLWIDTH_RE =
  /[ᄀ-ᅟ⺀-⻿　-ヿ㐀-䶿一-鿿가-힯豈-﫿︰-﹯＀-｠]/;

const ELLIPSIS = '…';

/** 单个字符（码点）的显示宽度 */
function charWidth(ch: string): number {
  // 星形平面字符（emoji 等 surrogates）按 2 列计
  if (ch.length > 1) return 2;
  return FULLWIDTH_RE.test(ch) ? 2 : 1;
}

/** 字符串的可见列宽（忽略 ANSI 转义序列） */
export function visibleWidth(text: string): number {
  if (!text) return 0;
  const plain = text.replace(ANSI_SGR_RE, '');
  let width = 0;
  for (const ch of [...plain]) width += charWidth(ch);
  return width;
}

/** 把一行裁到指定列宽（保留转义序列；末尾补省略号并归位颜色） */
export function clipLine(line: string, columns: number): string {
  if (columns <= 0) return line;
  if (visibleWidth(line) <= columns) return line;

  const chars = [...line];
  let out = '';
  let width = 0;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    // 转义序列整段复制，不占列宽
    if (ch === '\x1b') {
      let seq = ch;
      for (let j = i + 1; j < chars.length; j++) {
        seq += chars[j];
        if (chars[j] === 'm') { i = j; break; }
      }
      out += seq;
      continue;
    }

    const w = charWidth(ch);
    // 留 1 列给省略号
    if (width + w > columns - 1) return `${out}${ELLIPSIS}${RESET}`;
    out += ch;
    width += w;
  }

  return out;
}

/** 读取 Claude Code 注入的终端列宽；拿不到返回 0（不裁剪） */
export function getTerminalColums(): number {
  const raw = process.env?.COLUMNS;
  if (!raw) return 0;
  const num = Number(raw);
  if (Number.isNaN(num) || num <= 0) return 0;
  return Math.floor(num);
}

/** 逐行裁剪，并按 maxLines 限行（maxLines <= 0 表示不限） */
export function fitLines(lines: string[], columns: number, maxLines: number = 0): string[] {
  let out = lines.map((line: string) => clipLine(line, columns));
  if (maxLines > 0 && out.length > maxLines) out = out.slice(0, maxLines);
  return out;
}
