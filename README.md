# ClaudeHud 🖥️

> 为 Claude Code CLI 提供实时 HUD 状态栏

在 Claude Code 的命令行界面底部显示一个实时状态栏，包含：

- **🤖 模型名称** — 当前使用的 Claude 模型
- **📊 上下文进度条** — 可视化显示上下文窗口使用百分比
- **🔧 工具活动** — 实时显示正在运行和已完成的工具调用
- **🌿 Git 状态** — 当前分支和脏状态指示
- **📈 使用率** — Claude 订阅的使用率限制（5小时/7天窗口）

## 安装

```bash
git clone https://github.com/yourname/claudehud
cd claudehud
npm install
npm run build
```

## 配置

### 方法一：在 Claude Code settings.json 中配置

编辑 `~/.claude/settings.json`，添加 `statusLine` 配置：

```json
{
  "statusLine": "node F:/ClaudeHub/dist/index.js"
}
```

### 方法二：使用配置文件

在项目根目录或 home 目录下创建 `.claudehud.json`：

```json
{
  "language": "zh",
  "lineLayout": "expanded",
  "display": {
    "showModel": true,
    "showContextBar": true,
    "showTools": true,
    "showUsage": true
  }
}
```

## 显示效果

### 展开模式（默认）

```
[Opus 4.6] │ my-project git:(main*)
上下文 █████░░░░░ 45% │ 使用率 5h: ██░░░░░░░░ 25%
◐ Edit: auth.ts | ✓ Read ×3 | ✓ Grep ×2
```

### 紧凑模式

```
[Opus 4.6] │ my-project │ 上下文 ████░░░░░░ 40% │ 5h: ██░░░░░░░░ 25%
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `language` | `en` \| `zh` | `zh` | 界面语言 |
| `lineLayout` | `expanded` \| `compact` | `expanded` | 布局模式 |
| `pathLevels` | 1-3 | 1 | 项目路径显示深度 |
| `display.showModel` | boolean | true | 显示模型名称 |
| `display.showContextBar` | boolean | true | 显示上下文进度条 |
| `display.contextValue` | `percent` \| `tokens` \| `both` | `percent` | 上下文数值格式 |
| `display.showTools` | boolean | true | 显示工具活动行 |
| `display.showUsage` | boolean | true | 显示使用率限制 |
| `display.usageBarEnabled` | boolean | true | 使用率显示为进度条 |

## 工作原理

```
Claude Code → stdin JSON → ClaudeHub → stdout → 终端状态栏显示
           ↘ transcript JSONL（工具、Agent、待办）
```

1. Claude Code 通过 stdin 传入 JSON 数据（模型、上下文窗口、token 用量等）
2. ClaudeHub 解析这些数据 + transcript 文件
3. 渲染为带 ANSI 颜色的文本输出
4. Claude Code 将输出显示在终端底部的状态栏区域

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
│   ├── index.ts              # 主入口
│   ├── types.ts              # 类型定义
│   ├── constants.ts          # 常量
│   ├── stdin.ts              # stdin 读取和解析
│   ├── transcript.ts         # Transcript JSONL 解析
│   ├── git.ts                # Git 状态获取
│   ├── config.ts             # 配置加载
│   └── render/
│       ├── index.ts          # 渲染器主入口
│       ├── colors.ts         # ANSI 颜色和进度条
│       └── lines/            # 各行渲染逻辑
│           ├── session-line.ts
│           ├── context-line.ts
│           ├── usage.ts
│           ├── tools-line.ts
│           ├── agents-line.ts
│           └── todos-line.ts
├── dist/                     # 编译输出
├── .claudehub.json           # 配置文件
└── package.json
```

## 灵感来源

本项目受 [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) 启发，
使用 TypeScript + Node.js 实现，支持中文界面。

## 许可证

MIT
