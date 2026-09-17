// ============================================================
// 列宽自适应
// ============================================================
//
// 状态栏任何一行超过终端列宽，终端会折行，而 Claude Code 按逻辑行记账，
// 后续重绘就会错位错乱。这里按 COLUMNS 把每行裁到列宽以内。

pub const RESET: &str = "\x1b[0m";
pub const DIM: &str = "\x1b[2m";
pub const RED: &str = "\x1b[31m";
pub const GREEN: &str = "\x1b[32m";
pub const YELLOW: &str = "\x1b[33m";
pub const MAGENTA: &str = "\x1b[35m";
pub const CYAN: &str = "\x1b[36m";
pub const BRIGHT_BLUE: &str = "\x1b[94m";
pub const BRIGHT_MAGENTA: &str = "\x1b[95m";

const ELLIPSIS: char = '…';

/// 判断是否为全宽（双列）字符
fn is_wide(c: char) -> bool {
    matches!(c as u32,
        0x1100..=0x115F |     // 谚文字母
        0x2E80..=0x303E |     // CJK 部首、假名标点
        0x3041..=0x33FF |     // 假名、CJK 兼容
        0x3400..=0x4DBF |     // CJK 扩展 A
        0x4E00..=0x9FFF |     // CJK 统一表意
        0xA000..=0xA4CF |     // 彝文
        0xAC00..=0xD7A3 |     // 谚文音节
        0xF900..=0xFAFF |     // CJK 兼容表意
        0xFE30..=0xFE6F |     // CJK 兼容形式
        0xFF00..=0xFF60 |     // 全角形式
        0xFFE0..=0xFFE6 |
        0x1F300..=0x1F64F |   // 表情符号
        0x1F900..=0x1F9FF |
        0x20000..=0x3FFFD
    )
}

/// 字符串的可见列宽（忽略 ANSI 转义序列，CJK / emoji 按 2 列）
pub fn visible_width(s: &str) -> usize {
    let mut width = 0usize;
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // 跳过 CSI 序列：ESC [ ... 终止字符
            if chars.peek() == Some(&'[') {
                chars.next();
                for c2 in chars.by_ref() {
                    if c2.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
            continue;
        }
        // 控制字符不占宽度
        if (c as u32) < 0x20 || (0x7f..=0x9f).contains(&(c as u32)) {
            continue;
        }
        width += if is_wide(c) { 2 } else { 1 };
    }
    width
}

/// 把一行裁到指定列宽（保留转义序列，超宽处补省略号并归位颜色）
pub fn clip_line(line: &str, columns: usize) -> String {
    if columns == 0 || visible_width(line) <= columns {
        return line.to_string();
    }

    let mut out = String::new();
    let mut width = 0usize;
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        // 转义序列整段复制，不占列宽
        if c == '\x1b' {
            out.push(c);
            if chars.peek() == Some(&'[') {
                out.push(chars.next().unwrap());
                for c2 in chars.by_ref() {
                    out.push(c2);
                    if c2.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
            continue;
        }

        let w = if (c as u32) < 0x20 || (0x7f..=0x9f).contains(&(c as u32)) {
            0
        } else if is_wide(c) {
            2
        } else {
            1
        };

        // 留 1 列给省略号
        if width + w > columns.saturating_sub(1) {
            out.push(ELLIPSIS);
            out.push_str(RESET);
            return out;
        }
        out.push(c);
        width += w;
    }

    out
}

/// 读取 Claude Code 注入的终端列宽；拿不到返回 0（不裁剪）
pub fn terminal_columns() -> usize {
    std::env::var("COLUMNS")
        .ok()
        .and_then(|v| v.trim().parse::<usize>().ok())
        .filter(|n| *n > 0)
        .unwrap_or(0)
}
