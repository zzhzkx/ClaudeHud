// ============================================================
// 颜色与进度条
// ============================================================

use crate::fit::{
    BRIGHT_BLUE, CYAN, DIM, GREEN, MAGENTA, RED, RESET, YELLOW,
};

pub fn wrap(text: &str, color: &str) -> String {
    format!("{}{}{}", color, text, RESET)
}

pub fn dim(t: &str) -> String {
    wrap(t, DIM)
}

pub fn cyan(t: &str) -> String {
    wrap(t, CYAN)
}

/// 上下文进度条颜色：绿 → 黄 → 橙 → 红 平滑渐变（24 位真彩色）
fn gradient_color(percent: f64) -> String {
    const STOPS: [(f64, (u8, u8, u8)); 6] = [
        (0.0, (0, 180, 0)),
        (25.0, (80, 200, 0)),
        (50.0, (200, 200, 0)),
        (70.0, (255, 160, 0)),
        (85.0, (255, 80, 0)),
        (100.0, (220, 0, 0)),
    ];

    let p = percent.clamp(0.0, 100.0);
    let mut lower = STOPS[0];
    let mut upper = STOPS[STOPS.len() - 1];
    for i in 0..STOPS.len() - 1 {
        if p >= STOPS[i].0 && p <= STOPS[i + 1].0 {
            lower = STOPS[i];
            upper = STOPS[i + 1];
            break;
        }
    }

    let range = upper.0 - lower.0;
    let t = if range == 0.0 { 0.0 } else { (p - lower.0) / range };
    let lerp = |a: u8, b: u8| -> u8 {
        (a as f64 + (b as f64 - a as f64) * t).round() as u8
    };
    format!(
        "\x1b[38;2;{};{};{}m",
        lerp(lower.1 .0, upper.1 .0),
        lerp(lower.1 .1, upper.1 .1),
        lerp(lower.1 .2, upper.1 .2)
    )
}

/// 上下文滑块进度条（标出 80% 自动压缩预警游标）
pub fn context_slider_bar(percent_usable: f64, width: usize) -> String {
    let clamped = percent_usable.clamp(0.0, 100.0);
    let filled = ((clamped / 100.0) * width as f64).round() as usize;

    let mut bar = String::new();
    bar.push_str(&gradient_color(clamped));
    for i in 0..width {
        if i < filled {
            bar.push('▓');
        } else {
            bar.push_str(DIM);
            bar.push('░');
            bar.push_str(RESET);
            bar.push_str(&gradient_color(clamped));
        }
    }
    bar.push_str(RESET);
    bar
}

/// 上下文进度条
pub fn context_bar(percent: f64, width: usize) -> String {
    let safe = percent.clamp(0.0, 100.0);
    let filled = ((safe / 100.0) * width as f64).round() as usize;
    let empty = width.saturating_sub(filled);
    format!(
        "{}{}{}{}{}",
        gradient_color(safe),
        "█".repeat(filled),
        DIM,
        "░".repeat(empty),
        RESET
    )
}

/// 使用率进度条
pub fn quota_bar(percent: f64, width: usize) -> String {
    let safe = percent.clamp(0.0, 100.0);
    let color = if safe >= 90.0 {
        RED
    } else if safe >= 75.0 {
        crate::fit::BRIGHT_MAGENTA
    } else {
        BRIGHT_BLUE
    };
    let filled = ((safe / 100.0) * width as f64).round() as usize;
    let empty = width.saturating_sub(filled);
    format!(
        "{}{}{}{}{}",
        color,
        "█".repeat(filled),
        DIM,
        "░".repeat(empty),
        RESET
    )
}

/// effort 级别配色
pub fn effort_color(level: &str) -> &'static str {
    match level {
        "low" => GREEN,
        "medium" => YELLOW,
        "high" => crate::fit::BRIGHT_MAGENTA,
        "xhigh" => MAGENTA,
        // max / ultracode 在 Node 版是动态循环，Rust 版固定为品红
        _ => MAGENTA,
    }
}

pub fn format_tokens(n: u64) -> String {
    if n >= 1_000_000 {
        format!("{:.1}M", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        format!("{:.0}k", n as f64 / 1_000.0)
    } else {
        n.to_string()
    }
}
