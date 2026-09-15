# ClaudeHud 🖥️

> 为 Claude Code CLI 提供实时 HUD 状态栏

![preview](https://mintcdn.com/claude-code/nibzesLaJVh4ydOq/images/statusline-multiline.png)

在 Claude Code 的命令行界面底部显示一个实时状态栏，包含：

- **🤖 模型名称** — 当前使用的 Claude 模型（自动识别 ccswitch 映射名称）
- **📁 项目路径** — 当前工作目录
- **🌿 Git 状态** — 当前分支和脏状态指示
- **⏱ 会话时长** — 本次会话已用时间
- **📊 上下文进度条** — 可视化显示上下文窗口使用百分比和 token 数
- **📈 使用率** — Claude 订阅的使用率限制（5小时/7天窗口）
- **🔧 工具活动** — 实时显示正在运行和已完成的工具调用
- **📋 Session Tokens** — 本轮会话的输入/输出/缓存 token 用量
- **⚡ Effort** — 当前 reasoning effort 级别（按级别配色）

---

## 快速安装

### 前提条件

- [Node.js](https://nodejs.org/) ≥ 18
- [Claude Code CLI](https://code.claude.com/docs) 已安装

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/yourname/claudehub.git
cd claudehub

# 2. 安装依赖并构建
npm install
npm run build
```

### 配置 Claude Code

编辑 `~/.claude/settings.json`，添加 `statusLine` 配置：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /你的项目路径/claudehub/dist/index.js"
  }
}
```

> **注意**：将 `/你的项目路径/claudehub` 替换为实际克隆的目录路径。

<<<<<<< HEAD
在项目根目录或 home 目录下创建 `.claudehud.json`：
=======
重启 Claude Code 后，状态栏会自动显示在终端底部。

---

## 配置

ClaudeHub 会在以下位置查找配置文件（**第一个找到的生效**）：

1. `./.claudehub.json` — 项目根目录
2. `./.claude/claudehub.json` — 项目 `.claude` 目录
3. `~/.claudehub.json` — 用户 home 目录
4. `~/.claude/claudehub.json` — home `.claude` 目录

### 完整配置示例
>>>>>>> 6f60f91 (feat: 添加会话时长、session token 用量显示，修复模型名称和 pathLevels)

```json
{
  "language": "zh",
  "lineLayout": "expanded",
  "pathLevels": 1,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": false
  },
  "display": {
    "showModel": true,
    "showContextBar": true,
    "contextValue": "both",
    "showTools": true,
    "showAgents": false,
    "showTodos": false,
    "showUsage": true,
    "usageBarEnabled": true,
    "showDuration": true,
    "showSessionTokens": true,
    "maxLines": 0
  },
  "colors": {
    "context": "gradient",
    "usage": "brightBlue",
    "warning": "yellow",
    "critical": "red",
    "model": "cyan",
    "project": "yellow",
    "git": "magenta",
    "gitBranch": "cyan",
    "label": "dim",
    "effort": "auto"
  }
}
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `language` | `en` \| `zh` | `zh` | 界面语言 |
| `lineLayout` | `expanded` \| `compact` | `expanded` | 布局模式 |
| `pathLevels` | number | `0` | 项目路径显示深度（0=智能截断） |
| `gitStatus.enabled` | boolean | `true` | 显示 Git 状态 |
| `gitStatus.showDirty` | boolean | `true` | 显示脏状态指示（●） |
| `display.showModel` | boolean | `true` | 显示模型名称 |
| `display.showContextBar` | boolean | `true` | 显示上下文进度条 |
| `display.contextValue` | `percent` \| `tokens` \| `remaining` \| `both` | `both` | 上下文数值格式 |
| `display.showTools` | boolean | `true` | 显示工具活动行 |
| `display.showAgents` | boolean | `false` | 显示子 Agent 活动行 |
| `display.showTodos` | boolean | `false` | 显示待办进度行 |
| `display.showUsage` | boolean | `true` | 显示使用率限制 |
| `display.usageBarEnabled` | boolean | `true` | 使用率显示为进度条 |
| `display.showDuration` | boolean | `false` | 显示会话时长 |
| `display.showSessionTokens` | boolean | `false` | 显示 Session Token 用量 |
| `display.maxLines` | number | `0` | 状态栏最多显示行数（`0` = 不限） |
| `colors.context` | string | `gradient` | 上下文进度条颜色；`gradient` = 真彩色平滑渐变 |
| `colors.effort` | string | `auto` | effort 颜色；`auto` = 按级别取色（low 绿 / medium 黄 / high 亮品红 / xhigh 品红 / max 与 ultracode 动态循环） |

---

## 宽度自适应

状态栏的每一行如果超过终端列宽，终端会把这一行**折成两行**，而 Claude Code 是按
“逻辑行”做光标记账的，于是后续重绘就会错位、错乱（表现为状态栏花屏，重新拉伸
一次终端窗口才恢复）。

ClaudeHub 因此在渲染末尾读取 Claude Code 注入的环境变量 `COLUMNS`（终端列宽），
把每一行裁到列宽以内（宽度感知：CJK / emoji 按 2 列计，ANSI 转义序列不占列宽，
超宽处补省略号 `…`）。同时清洗 transcript 文本里的换行 / 控制字符，避免一条
待办或 Agent 描述里残留的 `\n` 让状态栏多出物理行。

拿不到 `COLUMNS` 时不裁剪（保持原样输出）。

---

## 每次渲染的开销

状态栏命令是**每次重绘新起一个进程**（不是常驻进程），所以进程内缓存一律无效：

- 每次渲染 = 1 次 `settings.json` 读取 + 1 次 transcript 全量解析 + 1 次 git 调用 + 渲染
- transcript 全量解析实测约 **25ms / 5MB**，不值得为它做增量缓存；原先的“增量解析”
  在每次渲染都是新进程的前提下永远走不到（该分支与相关的进程内缓存已删除）
- git 状态由一次 `git status --short --branch` 同时给出分支 / 脏状态 / 领先落后
  （原先要跑 3 个 git 子进程）

---

## 与 ccswitch 配合使用

如果你使用 [ccswitch](https://github.com/ekinndev/ccswitch) 切换模型，ClaudeHub 可以自动显示 ccswitch 配置的模型名称。

### ccswitch 配置方式

在 `~/.claude/settings.json` 中配置 ccswitch 的环境变量：

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME": "LongCat-2.0-Preview",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-8",
    "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME": "LongCat-2.0-Preview",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME": "LongCat-2.0-Preview"
  }
}
```

ClaudeHub 会自动读取 `ANTHROPIC_DEFAULT_*_MODEL_NAME` 作为模型显示名称。

### 模型名称解析优先级

1. **ccswitch 映射名称** — 从 `settings.json` 的 `env` 中读取
2. **Claude Code 原生 display_name** — stdin 中的 `model.display_name`
3. **从 model.id 解析** — 如 `claude-sonnet-4-6` → `Claude Sonnet 4.6`

---

## 显示效果

### 展开模式（默认）

```
🤖 [LongCat-2.0-Preview] │ 📁 ClaudeHud │ 🌿 main ● │ ⏱ 2h 15m
上下文 █████░░░░░ 45% (90k/200k) │ 使用率 5h: ██░░░░░░░░ 25% | 7d: █░░░░░░░░░ 10% │ ⚡ high
◐ Edit: auth.ts │ ✓ Read ×3 │ ✓ Grep ×2
📥 输入 45k │ 📤 输出 12k │ ✏️ 缓存写 8k │ 📖 缓存读 120k
```

### 紧凑模式

```
🤖 [LongCat-2.0-Preview] │ 📁 ClaudeHud │ 上下文 ████░░░░░░ 40% │ 5h: ██░░░░░░░░ 25%
```

---

## 工作原理

```
Claude Code → stdin JSON → ClaudeHub → stdout → 终端状态栏显示
           ↘ transcript JSONL（工具、Agent、待办）
           ↘ settings.json（ccswitch 模型名称映射）
           ↘ git 命令（分支、脏状态）
```

1. Claude Code 通过 stdin 传入 JSON 数据（模型、上下文窗口、token 用量等）
2. ClaudeHub 解析这些数据 + transcript 文件 + settings.json
3. 渲染为带 ANSI 真彩色渐变的文本输出
4. Claude Code 将输出显示在终端底部的状态栏区域

---

## 开发

```bash
npm install      # 安装依赖
npm run build    # 编译 TypeScript
npm run dev      # 监听模式编译
npm test         # 运行测试
```

## 项目结构

```
ClaudeHub/
├── src/
│   ├── index.ts                    # 主入口（数据获取、渲染调度）
│   ├── types.ts                    # 类型定义 + 默认配置
│   ├── constants.ts                # 常量（阈值、上下文窗口大小）
│   ├── stdin.ts                    # stdin 读取、模型名称解析、token 计算
│   ├── transcript.ts               # Transcript JSONL 解析（含文本清洗）
│   ├── git.ts                      # Git 状态获取（单次 git 调用）
│   ├── config.ts                   # 配置文件加载
│   └── render/
│       ├── index.ts                # 渲染器主入口（布局调度）
│       ├── colors.ts               # ANSI 颜色、真彩色渐变、进度条
│       ├── fit.ts                  # 列宽自适应（裁剪超宽行，防折行错乱）
│       └── lines/                  # 各行渲染逻辑
│           ├── session-line.ts     # 模型 + 项目 + Git + 时长
│           ├── context-line.ts     # 上下文进度条
│           ├── usage.ts            # 使用率进度条
│           ├── effort.ts           # reasoning effort 级别
│           ├── tools-line.ts       # 工具活动
│           ├── agents-line.ts      # Agent 活动
│           ├── todos-line.ts       # 待办进度
│           └── session-tokens-line.ts  # Session Token 用量
├── dist/                           # 编译输出
├── .claudehub.json                 # 项目配置文件
└── package.json
```

## 灵感来源

本项目受 [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) 启发，
使用 TypeScript + Node.js 实现，支持中文界面、真彩色渐变进度条、ccswitch 集成。

## 许可证

MIT
