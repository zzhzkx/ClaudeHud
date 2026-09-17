// ============================================================
// 配置加载
// ============================================================

use std::path::PathBuf;

use crate::json::{self, Json};

#[derive(Debug, Clone)]
pub struct Config {
    pub show_model: bool,
    pub show_context_bar: bool,
    pub show_usage: bool,
    pub show_duration: bool,
    pub show_effort: bool,
    pub show_speed: bool,
    pub show_session_tokens: bool,
    pub speed_window: u64,
    pub context_value: ContextValue,
    pub path_levels: usize,
    pub max_lines: usize,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ContextValue {
    Percent,
    Tokens,
    Remaining,
    Both,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            show_model: true,
            show_context_bar: true,
            show_usage: true,
            show_duration: true,
            show_effort: true,
            show_speed: true,
            show_session_tokens: true,
            speed_window: 30,
            context_value: ContextValue::Both,
            path_levels: 1,
            max_lines: 0,
        }
    }
}

fn candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        paths.push(cwd.join(".claudehub.json"));
        paths.push(cwd.join(".claude").join("claudehub.json"));
    }
    if let Some(home) = home_dir() {
        paths.push(home.join(".claudehub.json"));
        paths.push(home.join(".claude").join("claudehub.json"));
    }
    paths
}

pub fn home_dir() -> Option<PathBuf> {
    std::env::var("USERPROFILE")
        .ok()
        .map(PathBuf::from)
        .or_else(|| std::env::var("HOME").ok().map(PathBuf::from))
}

impl Config {
    pub fn load() -> Self {
        let mut cfg = Config::default();
        for path in candidate_paths() {
            if let Ok(raw) = std::fs::read_to_string(&path) {
                if let Some(json) = json::parse(&raw) {
                    cfg.apply(&json);
                    break;
                }
            }
        }
        cfg
    }

    fn apply(&mut self, root: &Json) {
        let display = root.get("display");
        let flag = |key: &str| display.and_then(|d| d.get(key)).and_then(|v| match v {
            Json::Bool(b) => Some(*b),
            _ => None,
        });

        if let Some(v) = flag("showModel") {
            self.show_model = v;
        }
        if let Some(v) = flag("showContextBar") {
            self.show_context_bar = v;
        }
        if let Some(v) = flag("showUsage") {
            self.show_usage = v;
        }
        if let Some(v) = flag("showDuration") {
            self.show_duration = v;
        }
        if let Some(v) = flag("showEffort") {
            self.show_effort = v;
        }
        if let Some(v) = flag("showSpeed") {
            self.show_speed = v;
        }
        if let Some(v) = flag("showSessionTokens") {
            self.show_session_tokens = v;
        }

        if let Some(n) = display
            .and_then(|d| d.get("speedWindow"))
            .and_then(|v| v.as_u64())
        {
            self.speed_window = n;
        }
        if let Some(n) = display
            .and_then(|d| d.get("maxLines"))
            .and_then(|v| v.as_u64())
        {
            self.max_lines = n as usize;
        }
        if let Some(n) = root.get("pathLevels").and_then(|v| v.as_u64()) {
            self.path_levels = n as usize;
        }

        if let Some(mode) = display
            .and_then(|d| d.get("contextValue"))
            .and_then(|v| v.as_str())
        {
            self.context_value = match mode {
                "percent" => ContextValue::Percent,
                "tokens" => ContextValue::Tokens,
                "remaining" => ContextValue::Remaining,
                _ => ContextValue::Both,
            };
        }
    }
}
