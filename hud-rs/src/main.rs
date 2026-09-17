// ============================================================
// ClaudeHub (Rust) - Claude Code 状态栏
// ============================================================

mod colors;
mod config;
mod fit;
mod git;
mod json;
mod render;
mod speed;
mod stdin;
mod transcript;

use render::RenderInput;

fn main() {
    let profile = std::env::var("CLAUDEHUB_PROFILE").is_ok();
    let t0 = std::time::Instant::now();

    let payload = match stdin::read_stdin() {
        Some(p) => p,
        None => return,
    };
    let t_read = t0.elapsed();

    let cfg = config::Config::load();
    let t_cfg = t0.elapsed();

    let transcript_path = payload
        .get("transcript_path")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let cwd = payload.get("cwd").and_then(|v| v.as_str());
    let git_info = git::status(cwd);
    let t_git = t0.elapsed();

    let model = stdin::model_name(&payload);
    let t_model = t0.elapsed();

    let session_start = if transcript_path.is_empty() {
        None
    } else {
        transcript::first_timestamp_ms(transcript_path)
    };
    let t_start = t0.elapsed();

    let output_speed = if cfg.show_speed {
        speed::output_speed(transcript_path, cfg.speed_window)
    } else {
        None
    };
    let t_speed = t0.elapsed();

    let last_latency = if cfg.show_latency {
        transcript::last_turn_latency_sec(transcript_path)
    } else {
        None
    };
    let t_latency = t0.elapsed();

    let input = RenderInput {
        stdin: &payload,
        config: &cfg,
        git: &git_info,
        model_name: &model,
        session_start_ms: session_start,
        output_speed,
        last_latency_sec: last_latency,
    };
    let out = render::render(&input);
    let t_render = t0.elapsed();

    if profile {
        eprintln!("read_stdin   {:>6.1}ms", t_read.as_secs_f64() * 1000.0);
        eprintln!("load_config  {:>6.1}ms", (t_cfg - t_read).as_secs_f64() * 1000.0);
        eprintln!("git          {:>6.1}ms", (t_git - t_cfg).as_secs_f64() * 1000.0);
        eprintln!("model_name   {:>6.1}ms", (t_model - t_git).as_secs_f64() * 1000.0);
        eprintln!("first_ts     {:>6.1}ms", (t_start - t_model).as_secs_f64() * 1000.0);
        eprintln!("speed        {:>6.1}ms", (t_speed - t_start).as_secs_f64() * 1000.0);
        eprintln!("latency      {:>6.1}ms", (t_latency - t_speed).as_secs_f64() * 1000.0);
        eprintln!("render       {:>6.1}ms", (t_render - t_latency).as_secs_f64() * 1000.0);
        eprintln!("TOTAL        {:>6.1}ms", t_render.as_secs_f64() * 1000.0);
    }
    print!("{}", out);
}
