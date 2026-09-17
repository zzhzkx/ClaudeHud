// ============================================================
// stdin 读取与模型名解析
// ============================================================

use std::collections::HashMap;
use std::io::Read;

use crate::config::home_dir;
use crate::json::{self, Json};

/// 从 stdin 读取 Claude Code 传入的 JSON
pub fn read_stdin() -> Option<Json> {
    let mut raw = String::new();
    std::io::stdin().read_to_string(&mut raw).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(v) = json::parse(trimmed) {
        return Some(v);
    }
    // 兜底：逐行从后往前找第一个能解析的
    for line in trimmed.lines().rev() {
        if line.trim().is_empty() {
            continue;
        }
        if let Some(v) = json::parse(line) {
            return Some(v);
        }
    }
    None
}

/// 从 settings.json 读取 ccswitch 的模型名映射
fn model_name_map() -> HashMap<String, String> {
    let mut map = HashMap::new();
    let home = match home_dir() {
        Some(h) => h,
        None => return map,
    };

    for rel in [".claude/settings.json", ".claude.json"] {
        let path = home.join(rel);
        let raw = match std::fs::read_to_string(&path) {
            Ok(r) => r,
            Err(_) => continue,
        };
        let parsed = match json::parse(&raw) {
            Some(p) => p,
            None => continue,
        };
        let env = match parsed.get("env") {
            Some(e) => e,
            None => continue,
        };
        for (key, value) in env_object(env) {
            let upper = key.to_uppercase();
            if !upper.starts_with("ANTHROPIC_DEFAULT_") || !upper.ends_with("_MODEL") {
                continue;
            }
            if let Some(name) = env_object(env)
                .iter()
                .find(|(k, _)| *k == format!("{}_NAME", key))
                .map(|(_, v)| v.clone())
            {
                map.insert(value.to_lowercase(), name);
            }
        }
        if !map.is_empty() {
            break;
        }
    }
    map
}

fn env_object(env: &Json) -> Vec<(String, String)> {
    match env {
        Json::Obj(m) => m
            .iter()
            .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
            .collect(),
        _ => Vec::new(),
    }
}

/// 解析模型显示名：ccswitch 映射 → display_name → 从 id 推导
pub fn model_name(stdin: &Json) -> String {
    let model_id = stdin
        .path(&["model", "id"])
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let map = model_name_map();
    if !map.is_empty() {
        let lower = model_id.to_lowercase();
        if let Some(name) = map.get(&lower) {
            return name.clone();
        }
        for (key, name) in &map {
            if lower.contains(key.as_str()) {
                return name.clone();
            }
        }
    }

    if let Some(display) = stdin
        .path(&["model", "display_name"])
        .and_then(|v| v.as_str())
    {
        if !display.trim().is_empty() {
            return display.trim().to_string();
        }
    }

    if model_id.is_empty() {
        return "Unknown".to_string();
    }
    normalize_model_id(&model_id)
}

/// `claude-sonnet-4-6` → `Claude Sonnet 4.6`
fn normalize_model_id(id: &str) -> String {
    let base = id.split('@').next().unwrap_or(id);
    let spaced = base.replace('-', " ");
    let titled: Vec<String> = spaced
        .split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect();
    titled.join(" ")
}
