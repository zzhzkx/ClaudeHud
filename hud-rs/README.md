# ClaudeHub (Rust)

Claude Code 状态栏的 Rust 实现。**冷启动约 8ms、热态约 16ms**，
用来替代仓库根目录的 Node 版（约 207ms）。

## 为什么重写

Node 版每次重绘都要新起一个 node 进程（~185ms 启动），这让「每秒刷新」
在 CPU 上不可接受（占满约 21% 的单个核）。Rust 版把启动压到 8ms，
并把 git 子进程换成跨进程缓存。

## 性能

实测（Windows 11，5MB transcript，各阶段由程序内探针计时）：

| 阶段 | 耗时 |
|---|---|
| read_stdin | 0.1ms |
| load_config | 0.2ms |
| git（缓存命中） | 0.5ms |
| model_name | 0.2ms |
| first_ts | 0.6ms |
| speed（读尾部 1MB + 解析） | 15ms |
| render | 0.1ms |
| **合计** | **~17ms** |

对比：

| | 单次耗时 | `refreshInterval: 1` 的 CPU |
|---|---|---|
| Node 版 | ~207ms | ~21% 单核 |
| **Rust 版** | **~17ms** | **~1.7% 单核** |

> 测量说明：用 `spawnSync`/`date` 等在外部计时会被 Windows 的进程启动与管道
> 握手成本污染（外部测出 57–93ms，而程序内探针只有 17ms）。上表数字来自
> 程序内的 `Instant` 探针，用 `CLAUDEHUB_PROFILE=1` 可复现。

## 构建

需要 Rust 工具链（rustup）。无第三方依赖，只用标准库。

```bash
cd hud-rs
cargo build --release
# 产物：target/release/claudehub.exe
```

## 配置

在 `~/.claude/settings.json` 里指向新二进制：

```json
{
  "statusLine": {
    "type": "command",
    "command": "F:/claude_project/ClaudeHud/hud-rs/target/release/claudehub.exe",
    "refreshInterval": 1
  }
}
```

配置文件（`.claudehub.json`）的搜索顺序与 Node 版一致：项目根 → 项目 `.claude/`
→ home → home `.claude/`。目前支持的字段：

```json
{
  "pathLevels": 1,
  "display": {
    "showModel": true,
    "showContextBar": true,
    "contextValue": "both",
    "showUsage": true,
    "showDuration": true,
    "showEffort": true,
    "showSpeed": true,
    "speedWindow": 30,
    "showSessionTokens": true,
    "maxLines": 0
  }
}
```

## 与 Node 版的差异

Rust 版**只实现当前实际在用的功能**：

- 第 1 行：模型名 │ 路径 │ git 分支 │ 会话时长（精确到秒）
- 第 2 行：上下文进度条 │ 使用率 │ effort │ 输出速度
- 第 3 行：session token 用量

**未移植**（Node 版有，但实际输出为空、属于已知缺陷）：

- 工具活动行 / Agent 活动行 / 待办行
  —— 这两行的解析器跟不上 transcript 的新结构（`message.content` 嵌套），
  在任何真实会话里都渲染不出内容
- `materials`：elementOrder、language、colors 自定义、紧凑布局、
  usageBarEnabled、max / ultracode 的动态循环配色

## 关键实现说明

**宽度自适应**（`fit.rs`）：按 `COLUMNS` 把每行裁到终端列宽，CJK/emoji 按
2 列计、ANSI 转义序列不占宽。状态栏任何一行超宽都会被终端折行，而
Claude Code 按逻辑行记账，会导致重绘错位 —— 这是状态栏花屏的根因。

**输出速度**（`speed.rs`）：口径照搬 [ccstatusline](https://github.com/sirmalloc/ccstatusline)（MIT）。
每条 assistant 的生成区间 = [上一条 user 的时间戳, 本条的时间戳]，
合并所有重叠区间求总长，`outputTokens ÷ 总长`。合并重叠是关键 ——
并发的子 Agent 会让区间重叠，不合并就会重复计时。
transcript 里没有请求发起时间，所以**首字延迟（TTFT）无法计算**。

**git 缓存**（`git.rs`）：`git status` 在 Windows 上要 ~38ms（光进程启动
就 ~16ms），而读一个缓存文件只要 0.11ms。所以结果写进
`%TEMP%/claudehub/git-<hash>.json`（TTL 5 秒）：命中就直接用，过期则
**先用旧值渲染、同时后台线程刷新**，不阻塞本次输出。

## 已知取舍

- **会话时长**取自 transcript 第一条带时间戳的记录。被 resume 过的会话会
  显示得偏大（它统计的是整条链的跨度，不是本次对话时长）。Claude Code
  `/status` 用的是另一套口径（扣掉空闲的活跃时长），那个值只在
  `cost-state` 条目里且写入稀疏，无法可靠复现。
- `max` / `ultracode` 的 effort 配色在 Node 版是动态循环，Rust 版固定为品红。
