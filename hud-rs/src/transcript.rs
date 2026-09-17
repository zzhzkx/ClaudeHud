// ============================================================
// Transcript 读取
// ============================================================
//
// 只读尾部一段（滑动窗口足够），全会话均值才读全文件。

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};

use crate::json;

pub const TAIL_BYTES: u64 = 1024 * 1024;

/// 读取 transcript 的行（max_bytes == 0 表示读全文件）
pub fn read_lines(path: &str, max_bytes: u64) -> Vec<String> {
    if path.is_empty() {
        return Vec::new();
    }
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    let size = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => return Vec::new(),
    };
    if size == 0 {
        return Vec::new();
    }

    let full = max_bytes == 0 || size <= max_bytes;
    let length = if full { size } else { max_bytes };
    let offset = size - length;

    if file.seek(SeekFrom::Start(offset)).is_err() {
        return Vec::new();
    }
    let mut buf = vec![0u8; length as usize];
    if file.read_exact(&mut buf).is_err() {
        return Vec::new();
    }

    let text = String::from_utf8_lossy(&buf).into_owned();
    let mut lines: Vec<String> = text.split('\n').map(|s| s.to_string()).collect();
    // 不是从文件头读起时，首行可能被切了一半，丢掉
    if offset > 0 && !lines.is_empty() {
        lines.remove(0);
    }
    lines
}

/// 把 ISO8601 时间戳（含毫秒与 Z）转成毫秒
pub fn parse_timestamp_ms(s: &str) -> Option<i64> {
    // 形如 2026-09-15T06:36:31.090Z
    let bytes = s.as_bytes();
    if bytes.len() < 19 {
        return None;
    }
    let num = |a: usize, b: usize| -> Option<i64> {
        std::str::from_utf8(bytes.get(a..b)?).ok()?.parse::<i64>().ok()
    };
    let year = num(0, 4)?;
    let month = num(5, 7)?;
    let day = num(8, 10)?;
    let hour = num(11, 13)?;
    let minute = num(14, 16)?;
    let second = num(17, 19)?;

    // 毫秒部分可选
    let millis = if bytes.len() >= 23 && bytes[19] == b'.' {
        num(20, 23)?
    } else if bytes.len() >= 21 && bytes[19] == b'.' {
        num(20, 21)? * 100
    } else {
        0
    };

    Some(days_from_civil(year, month, day) * 86_400_000
        + hour * 3_600_000
        + minute * 60_000
        + second * 1000
        + millis)
}

/// 公历 → 天数（Howard Hinnant 的 days_from_civil）
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// 当前 Unix 毫秒
pub fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// transcript 的第一条时间戳（用作会话开始时间）
///
/// 注意：文件开头若干条（mode / permission-mode / atis-latch 等）没有
/// timestamp，所以不能只看第一行；这里读头部 256KB 足够覆盖，读不到就放弃。
pub fn first_timestamp_ms(path: &str) -> Option<i64> {
    let mut file = File::open(path).ok()?;
    let mut buf = vec![0u8; 256 * 1024];
    let n = file.read(&mut buf).ok()?;
    let text = String::from_utf8_lossy(&buf[..n]);

    for line in text.split('\n') {
        if line.trim().is_empty() {
            continue;
        }
        if let Some(entry) = json::parse(line) {
            if let Some(ts) = entry.get("timestamp").and_then(|v| v.as_str()) {
                if let Some(ms) = parse_timestamp_ms(ts) {
                    return Some(ms);
                }
            }
        }
    }
    None
}

/// 读取最近一轮模型的响应耗时（从触发请求到收到 assistant 响应的时间差）
pub fn last_turn_latency_sec(path: &str) -> Option<f64> {
    if path.is_empty() {
        return None;
    }
    let lines = read_lines(path, 256 * 1024);
    if lines.is_empty() {
        return None;
    }

    let mut last_asst_ts: Option<i64> = None;

    // 从后往前扫最近的一组 user -> assistant
    for line in lines.iter().rev() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let entry = match json::parse(trimmed) {
            Some(e) => e,
            None => continue,
        };

        let entry_type = entry.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let ts = entry
            .get("timestamp")
            .and_then(|v| v.as_str())
            .and_then(parse_timestamp_ms);

        if entry_type == "assistant" && ts.is_some() && last_asst_ts.is_none() {
            last_asst_ts = ts;
        } else if entry_type == "user" && ts.is_some() && last_asst_ts.is_some() {
            let u_ts = ts.unwrap();
            let asst_ts = last_asst_ts.unwrap();
            if asst_ts >= u_ts {
                return Some((asst_ts - u_ts) as f64 / 1000.0);
            }
        }
    }

    None
}

/// 扫描 transcript，收集 assistant 的用量条目（按 message.id 去重）
pub fn collect_usage_entries(lines: &[String]) -> Vec<UsageEntry> {
    let mut out: Vec<UsageEntry> = Vec::new();
    let mut index_by_id: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut last_user_ts: Option<i64> = None;

    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        let entry = match json::parse(line) {
            Some(e) => e,
            None => continue,
        };
        let entry_type = entry.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let ts = entry
            .get("timestamp")
            .and_then(|v| v.as_str())
            .and_then(parse_timestamp_ms);

        if entry_type == "user" {
            if ts.is_some() {
                last_user_ts = ts;
            }
            continue;
        }
        if entry_type != "assistant" {
            continue;
        }

        let message = match entry.get("message") {
            Some(m) => m,
            None => continue,
        };
        let usage = match message.get("usage") {
            Some(u) => u,
            None => continue,
        };

        let output_tokens = usage
            .get("output_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        // 生成区间 = [上一条 user, 本条]
        let interval = match (ts, last_user_ts) {
            (Some(end), Some(start)) if end > start => Some((start, end)),
            _ => None,
        };

        let item = UsageEntry {
            output_tokens,
            timestamp_ms: ts,
            interval,
        };

        match message.get("id").and_then(|v| v.as_str()) {
            Some(id) if !id.is_empty() => match index_by_id.get(id) {
                Some(&idx) => out[idx] = item,
                None => {
                    index_by_id.insert(id.to_string(), out.len());
                    out.push(item);
                }
            },
            _ => out.push(item),
        }
    }

    out
}

#[derive(Debug, Clone)]
pub struct UsageEntry {
    pub output_tokens: u64,
    pub timestamp_ms: Option<i64>,
    pub interval: Option<(i64, i64)>,
}

/// 合并重叠区间，返回总时长（毫秒）
pub fn merged_duration_ms(intervals: &[(i64, i64)]) -> i64 {
    if intervals.is_empty() {
        return 0;
    }
    let mut sorted = intervals.to_vec();
    sorted.sort_by_key(|(s, _)| *s);

    let mut merged: Vec<(i64, i64)> = vec![sorted[0]];
    for (start, end) in sorted.into_iter().skip(1) {
        let last = merged.last_mut().unwrap();
        if start <= last.1 {
            last.1 = last.1.max(end);
        } else {
            merged.push((start, end));
        }
    }
    merged.iter().map(|(s, e)| e - s).sum()
}

/// transcript 里最后一条记录的时间戳（含非 assistant 条目）
pub fn latest_timestamp_ms(lines: &[String]) -> Option<i64> {
    let mut latest: Option<i64> = None;
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        if let Some(entry) = json::parse(line) {
            if let Some(ts) = entry
                .get("timestamp")
                .and_then(|v| v.as_str())
                .and_then(parse_timestamp_ms)
            {
                latest = Some(latest.map_or(ts, |l: i64| l.max(ts)));
            }
        }
    }
    latest
}
