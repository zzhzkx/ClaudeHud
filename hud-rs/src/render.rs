// ============================================================
// 渲染
// ============================================================

use crate::colors::{
    context_bar, cyan, dim, effort_color, format_tokens, quota_bar, wrap,
};
use crate::config::{Config, ContextValue};
use crate::fit::{clip_line, terminal_columns, CYAN, YELLOW};
use crate::git::GitInfo;
use crate::json::Json;
use crate::transcript;

pub struct RenderInput<'a> {
    pub stdin: &'a Json,
    pub config: &'a Config,
    pub git: &'a GitInfo,
    pub model_name: &'a str,
    pub session_start_ms: Option<i64>,
    pub output_speed: Option<f64>,
    pub last_latency_sec: Option<f64>,
}

const SEP: &str = " │ ";

pub fn render(input: &RenderInput) -> String {
    let mut lines: Vec<String> = Vec::new();

    if let Some(line) = session_line(input) {
        lines.push(line);
    }
    if let Some(line) = context_line(input) {
        lines.push(line);
    }
    if let Some(line) = tokens_line(input) {
        lines.push(line);
    }

    let columns = terminal_columns();
    let mut fitted: Vec<String> = lines
        .iter()
        .map(|l| clip_line(l, columns))
        .collect();
    if input.config.max_lines > 0 && fitted.len() > input.config.max_lines {
        fitted.truncate(input.config.max_lines);
    }
    fitted.join("\n")
}

/// 第 1 行：模型 | 路径 | git | 时长
fn session_line(input: &RenderInput) -> Option<String> {
    let mut parts: Vec<String> = Vec::new();
    let cfg = input.config;

    if cfg.show_model && !input.model_name.is_empty() {
        parts.push(wrap(&format!("🤖 [{}]", input.model_name), CYAN));
    }

    let cwd = input
        .stdin
        .get("cwd")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if !cwd.is_empty() {
        parts.push(wrap(&format!("📁 {}", display_path(cwd, cfg.path_levels)), YELLOW));
    }

    if !input.git.branch.is_empty() {
        let dirty = if input.git.dirty { " ●" } else { "" };
        parts.push(format!("🌿 {}{}", cyan(&input.git.branch), dirty));
    }

    if cfg.show_duration {
        if let Some(start) = input.session_start_ms {
            let elapsed = transcript::now_ms() - start;
            if elapsed > 0 {
                parts.push(dim(&format!("⏱ {}", format_duration(elapsed))));
            }
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(SEP))
    }
}

/// 第 2 行：上下文 | 使用率 | effort | 速度
fn context_line(input: &RenderInput) -> Option<String> {
    let cfg = input.config;
    let mut parts: Vec<String> = Vec::new();

    if cfg.show_context_bar {
        let percent = context_percent(input.stdin);
        let cur_tok = current_tokens(input.stdin);
        let size = context_window_size(input.stdin);

        let value = match cfg.context_value {
            ContextValue::Percent => format!("{:.0}%", percent),
            ContextValue::Remaining => format!("{:.0}%", 100.0 - percent),
            ContextValue::Tokens => {
                format!(
                    "{}/{}",
                    format_tokens(cur_tok),
                    format_tokens(size)
                )
            }
            ContextValue::Both => {
                format!(
                    "{:.0}% ({}/{})",
                    percent,
                    format_tokens(cur_tok),
                    format_tokens(size)
                )
            }
        };

        if cfg.show_context_slider {
            // 可用上下文计算：80% 触发自动压缩
            let usable_tokens = (size as f64 * 0.8).floor() as u64;
            let usable_pct = if usable_tokens > 0 {
                (cur_tok as f64 / usable_tokens as f64 * 100.0).clamp(0.0, 100.0)
            } else {
                percent
            };
            parts.push(format!(
                "{} {} {} {}",
                dim("上下文"),
                crate::colors::context_slider_bar(usable_pct, 10),
                value,
                dim(&format!("[可用{:.0}%]", usable_pct))
            ));
        } else {
            parts.push(format!(
                "{} {} {}",
                dim("上下文"),
                context_bar(percent, 10),
                value
            ));
        }
    }

    if cfg.show_usage {
        if let Some(usage) = usage_part(input.stdin) {
            parts.push(usage);
        }
    }

    if cfg.show_effort {
        // effort 有两种形态：字符串 "high"，或对象 {"level":"high"}
        let level = match input.stdin.get("effort") {
            Some(Json::Str(s)) if !s.is_empty() => Some(s.as_str()),
            Some(Json::Obj(_)) => input
                .stdin
                .path(&["effort", "level"])
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty()),
            _ => None,
        };
        if let Some(level) = level {
            parts.push(format!("{} {}", dim("⚡"), wrap(level, effort_color(level))));
        }
    }

    if cfg.show_speed {
        let text = match input.output_speed {
            Some(tps) if tps > 0.0 => {
                let formatted = if tps >= 1000.0 {
                    format!("{:.1}k t/s", tps / 1000.0)
                } else {
                    format!("{:.1} t/s", tps)
                };
                cyan(&formatted)
            }
            _ => dim("— t/s"),
        };
        parts.push(format!("{} {}", dim("🚀"), text));
    }

    if cfg.show_latency {
        let text = match input.last_latency_sec {
            Some(sec) if sec > 0.0 => {
                let formatted = if sec >= 60.0 {
                    format!("{:.0}m{:.0}s", sec / 60.0, sec % 60.0)
                } else {
                    format!("{:.1}s", sec)
                };
                cyan(&formatted)
            }
            _ => dim("—s"),
        };
        parts.push(format!("{} {}", dim("⚡RTT"), text));
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(SEP))
    }
}

/// 第 3 行：session token 用量
fn tokens_line(input: &RenderInput) -> Option<String> {
    if !input.config.show_session_tokens {
        return None;
    }
    let usage = input.stdin.path(&["context_window", "current_usage"])?;
    let get = |k: &str| usage.get(k).and_then(|v| v.as_u64()).unwrap_or(0);

    let input_tokens = get("input_tokens");
    let output_tokens = get("output_tokens");
    let cache_write = get("cache_creation_input_tokens");
    let cache_read = get("cache_read_input_tokens");

    if input_tokens == 0 && output_tokens == 0 {
        return None;
    }

    let mut parts: Vec<String> = Vec::new();
    if input_tokens > 0 {
        parts.push(format!("📥 {} {}", dim("输入"), cyan(&format_tokens(input_tokens))));
    }
    if output_tokens > 0 {
        parts.push(format!(
            "📤 {} {}",
            dim("输出"),
            wrap(&format_tokens(output_tokens), crate::fit::GREEN)
        ));
    }
    if cache_write > 0 {
        parts.push(format!(
            "✏️ {} {}",
            dim("缓存写"),
            wrap(&format_tokens(cache_write), YELLOW)
        ));
    }
    if cache_read > 0 {
        parts.push(format!("📖 {} {}", dim("缓存读"), dim(&format_tokens(cache_read))));
    }

    if input.config.show_cache_hit_rate {
        let cacheable = cache_read + cache_write;
        if cacheable > 0 {
            let hit_rate = (cache_read as f64 / cacheable as f64 * 100.0).clamp(0.0, 100.0);
            let hit_color = if hit_rate >= 80.0 {
                crate::fit::GREEN
            } else if hit_rate >= 50.0 {
                YELLOW
            } else {
                crate::fit::RED
            };
            parts.push(format!(
                "🎯 {} {}",
                dim("命中率"),
                wrap(&format!("{:.0}%", hit_rate), hit_color)
            ));
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(SEP))
    }
}

fn usage_part(stdin: &Json) -> Option<String> {
    let limits = stdin.get("rate_limits")?;
    let five = limits
        .path(&["five_hour", "used_percentage"])
        .and_then(|v| v.as_f64());
    let seven = limits
        .path(&["seven_day", "used_percentage"])
        .and_then(|v| v.as_f64());

    if five.is_none() && seven.is_none() {
        return None;
    }

    let mut parts: Vec<String> = Vec::new();
    if let Some(p) = five {
        parts.push(format!("5h: {} {:.0}%", quota_bar(p, 10), p));
    }
    if let Some(p) = seven {
        parts.push(format!("7d: {} {:.0}%", quota_bar(p, 10), p));
    }
    Some(format!("{} {}", dim("使用率"), parts.join(" | ")))
}

fn context_percent(stdin: &Json) -> f64 {
    if let Some(native) = stdin
        .path(&["context_window", "used_percentage"])
        .and_then(|v| v.as_f64())
    {
        if native > 0.0 {
            return native.clamp(0.0, 100.0);
        }
    }
    let size = context_window_size(stdin) as f64;
    if size <= 0.0 {
        return 0.0;
    }
    (current_tokens(stdin) as f64 / size * 100.0).clamp(0.0, 100.0)
}

fn current_tokens(stdin: &Json) -> u64 {
    let usage = match stdin.path(&["context_window", "current_usage"]) {
        Some(u) => u,
        None => return 0,
    };
    let get = |k: &str| usage.get(k).and_then(|v| v.as_u64()).unwrap_or(0);
    get("input_tokens") + get("cache_creation_input_tokens") + get("cache_read_input_tokens")
}

fn context_window_size(stdin: &Json) -> u64 {
    if let Some(n) = stdin
        .path(&["context_window", "context_window_size"])
        .and_then(|v| v.as_u64())
    {
        if n > 0 {
            return n;
        }
    }
    let model_id = stdin
        .path(&["model", "id"])
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    if model_id.contains("[1m]") || model_id.contains("-1m") {
        return 1_000_000;
    }
    200_000
}

/// 路径显示深度
fn display_path(cwd: &str, levels: usize) -> String {
    let normalized = cwd.replace('\\', "/");
    if levels == 0 {
        return normalized;
    }
    let segments: Vec<&str> = normalized.split('/').filter(|s| !s.is_empty()).collect();
    if segments.len() <= levels {
        return normalized;
    }
    segments[segments.len() - levels..].join("/")
}

pub fn format_duration(ms: i64) -> String {
    if ms < 0 {
        return "0s".to_string();
    }
    let seconds = ms / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    if hours > 0 {
        format!("{}h {}m {}s", hours, minutes % 60, seconds % 60)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, seconds % 60)
    } else {
        format!("{}s", seconds)
    }
}
