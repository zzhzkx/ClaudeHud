// ============================================================
// 输出速度（tok/s）
// ============================================================
//
// 口径照搬 ccstatusline（MIT）：
//   每条 assistant 的生成区间 = [上一条 user 的时间戳, 本条的时间戳]
//   合并所有重叠区间求总长，outputTokens ÷ 总长
//   合并重叠是精髓：并发的子 Agent 会让区间互相重叠，不合并就会重复计时。
//
// transcript 里没有请求发起时间，所以首字延迟（TTFT）无法计算。

use crate::transcript::{self, TAIL_BYTES};

pub fn output_speed(transcript_path: &str, window_seconds: u64) -> Option<f64> {
    if transcript_path.is_empty() {
        return None;
    }

    // 滑动窗口只需尾部一段；全会话均值（0）必须读全文件
    let max_bytes = if window_seconds > 0 { TAIL_BYTES } else { 0 };
    let lines = transcript::read_lines(transcript_path, max_bytes);
    if lines.is_empty() {
        return None;
    }

    let entries = transcript::collect_usage_entries(&lines);
    if entries.is_empty() {
        return None;
    }

    // 窗口终点取「已读到的最后一条记录」，而不是最后一条 assistant ——
    // 后者在工具执行期间会停在过去，让窗口不滚动、数字卡住
    let latest = transcript::latest_timestamp_ms(&lines)?;

    let (window_start, window_end) = if window_seconds > 0 {
        let end = latest;
        (Some(end - window_seconds as i64 * 1000), Some(end))
    } else {
        (None, None)
    };

    let mut output_tokens: u64 = 0;
    let mut intervals: Vec<(i64, i64)> = Vec::new();

    for entry in &entries {
        if let (Some(start), Some(end)) = (window_start, window_end) {
            match entry.timestamp_ms {
                Some(ts) if ts >= start && ts <= end => {}
                _ => continue,
            }
        }

        output_tokens += entry.output_tokens;

        let (iv_start, iv_end) = match entry.interval {
            Some(iv) => iv,
            None => continue,
        };

        match (window_start, window_end) {
            (Some(ws), Some(we)) => {
                let s = iv_start.max(ws);
                let e = iv_end.min(we);
                if e > s {
                    intervals.push((s, e));
                }
            }
            _ => intervals.push((iv_start, iv_end)),
        }
    }

    let duration_ms = transcript::merged_duration_ms(&intervals);
    if duration_ms <= 0 {
        return None;
    }

    Some(output_tokens as f64 / (duration_ms as f64 / 1000.0))
}
