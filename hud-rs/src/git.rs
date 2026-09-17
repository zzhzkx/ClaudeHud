// ============================================================
// Git 状态（带跨进程缓存）
// ============================================================
//
// 每次重绘都跑 `git status` 要 ~38ms（Windows 上光进程启动就 ~16ms），
// 而状态栏刷新频率很高。所以这里把结果写进缓存文件：
//   - 缓存新鲜（TTL 内）→ 直接读，约 0.1ms
//   - 缓存过期 → 先用旧值渲染，同时后台线程刷新缓存，不阻塞本次输出

use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Default, Clone)]
pub struct GitInfo {
    pub branch: String,
    pub dirty: bool,
}

/// 缓存有效期（毫秒）
const CACHE_TTL_MS: u128 = 5_000;

fn cache_path(cwd: &str) -> Option<PathBuf> {
    let base = std::env::var("TEMP")
        .ok()
        .or_else(|| std::env::var("TMP").ok())
        .map(PathBuf::from)?;
    let dir = base.join("claudehub");
    let _ = std::fs::create_dir_all(&dir);

    // 用 cwd 的简单哈希做文件名，避免非法字符
    let mut hash: u64 = 1469598103934665603;
    for byte in cwd.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    Some(dir.join(format!("git-{:016x}.json", hash)))
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// 读取缓存；返回 (结果, 是否新鲜)
fn read_cache(path: &PathBuf) -> Option<(GitInfo, bool)> {
    let raw = std::fs::read_to_string(path).ok()?;
    let json = crate::json::parse(&raw)?;

    let branch = json
        .get("branch")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let dirty = matches!(json.get("dirty"), Some(crate::json::Json::Bool(true)));
    let ts = json.get("ts").and_then(|v| v.as_f64()).unwrap_or(0.0) as u128;

    let fresh = now_ms().saturating_sub(ts) < CACHE_TTL_MS;
    Some((GitInfo { branch, dirty }, fresh))
}

fn write_cache(path: &PathBuf, info: &GitInfo) {
    let payload = format!(
        "{{\"branch\":{},\"dirty\":{},\"ts\":{}}}",
        json_escape(&info.branch),
        info.dirty,
        now_ms()
    );
    let _ = std::fs::write(path, payload);
}

fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// 真正跑 git（慢，~38ms）
fn run_git(cwd: Option<&str>) -> GitInfo {
    let mut cmd = Command::new("git");
    cmd.args(["status", "--short", "--branch"]);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = match cmd.output() {
        Ok(o) => o,
        Err(_) => return GitInfo::default(),
    };
    if !output.status.success() {
        return GitInfo::default();
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut lines = text.lines().filter(|l| !l.trim().is_empty());
    let header = match lines.next() {
        Some(h) => h,
        None => return GitInfo::default(),
    };

    GitInfo {
        branch: parse_branch(header),
        dirty: lines.next().is_some(),
    }
}

/// 获取 git 状态：优先用缓存，过期则后台异步刷新
pub fn status(cwd: Option<&str>) -> GitInfo {
    let cwd_str = cwd.unwrap_or("");
    let path = match cache_path(cwd_str) {
        Some(p) => p,
        None => return run_git(cwd), // 拿不到临时目录就退化成同步执行
    };

    if let Some((info, fresh)) = read_cache(&path) {
        if !fresh {
            // 后台刷新，不阻塞本次渲染
            let bg_path = path.clone();
            let bg_cwd = cwd.map(|s| s.to_string());
            std::thread::spawn(move || {
                let fresh_info = run_git(bg_cwd.as_deref());
                write_cache(&bg_path, &fresh_info);
            });
        }
        return info;
    }

    // 首次：只能同步等一次
    let info = run_git(cwd);
    write_cache(&path, &info);
    info
}

/// 从 `## main...origin/main [ahead 1]` 取分支名
fn parse_branch(header: &str) -> String {
    let mut rest = header.trim();
    if let Some(stripped) = rest.strip_prefix("##") {
        rest = stripped.trim();
    }
    if rest.is_empty() {
        return String::new();
    }
    if let Some(idx) = rest.find("...") {
        rest = &rest[..idx];
    }
    if let Some(idx) = rest.find(' ') {
        rest = &rest[..idx];
    }
    let name = rest.trim();
    if name.is_empty() || name == "HEAD" || name.starts_with("No commits") {
        return String::new();
    }
    name.to_string()
}
