# Claude Code Skill Router Plugin

一个面向 Claude Code 的 Skill Router 插件原型。

它的目标不是让模型在完整 skill 宇宙里自行挑选，而是在模型处理用户请求之前，先通过插件完成技能候选筛选，并把更小、更相关的上下文注入到 `additionalContext`。

当前仓库已经实现一个可运行的 **Compatibility Mode MVP**：

- 在 `SessionStart` 阶段初始化插件数据目录
- 扫描全局与项目内 skill 元数据
- 构建索引型 registry，而不是复制 skill 全文
- 在 `UserPromptSubmit` 阶段执行轻量路由
- 支持单 skill 路由，以及保守的多步骤 workflow 路由
- 输出离线校验与日志汇总能力

## 当前状态

当前版本仍以 **Compatibility Mode** 为主，重点是验证路由质量和上下文裁剪链路：

- 已实现 Compatibility Mode
- 已实现最小工作流识别与 summary-only workflow 注入
- 已实现索引重建、registry 校验、routing log 汇总
- 已提供 Managed Routing Mode 迁移/回滚脚本
- 尚未实现 embedding 检索、复杂历史权重、完整托管模式产品化

## 核心设计原则

- **先路由，后建模**：在 `UserPromptSubmit` hook 中完成分类、检索、打分、注入
- **Registry 只存索引**：保存 skill 路径和元数据，不复制 skill 正文
- **选择性上下文注入**：只把最相关 skill 或 workflow 的上下文交给模型
- **Compatibility Mode 与 Managed Routing Mode 分离**：当前默认保持兼容模式
- **信任边界明确**：只有可信的全局 skill 才允许注入原始正文指导

## 当前已实现能力

### 1. Skill 扫描与索引构建

初始化时会扫描两个来源：

- `~/.claude/skills/`
- `<project-root>/.claude/skills/`

当前会生成这些 registry 文件：

- `registry/skills.json`
- `registry/tags-index.json`
- `registry/hash-index.json`

### 2. Prompt 分类与技能打分

当前是轻量、规则驱动的实现：

- `router/classify-tags.js`：把 prompt 映射到最小 `domain_tags` / `task_tags`
- `router/score-skills.js`：综合 trigger、anti-trigger、分类标签进行打分
- `router/route.js`：选择 skill 或 workflow，并输出 hook payload

### 3. Workflow 路由

当前支持保守的多步骤工作流检测。

例如显式多阶段请求如“先调研再给出方案”会优先命中 workflow，而不是单一 skill。

默认内置 workflow 位于：

- `workflows/workflows.json`

### 4. 路由日志与离线分析

每次路由会把结果追加到：

- `${CLAUDE_PLUGIN_DATA}/stats/routing-log.jsonl`

并可离线汇总成 `stats.json`，统计：

- 总路由数
- skill / workflow / null 路由数
- confidence 分布
- 每个 skill / workflow 命中次数
- domain / task tag 频次

## 目录结构

```text
.claude-plugin/plugin.json   插件元数据
hooks/hooks.json             Claude Code hook 注册
router/                      路由主流程
  build-registry.js          共享索引构建逻辑
  classify-tags.js           prompt 标签分类
  init.js                    SessionStart 初始化入口
  inject-context.js          additionalContext 构建
  log-route.js               路由日志写入
  resolve-workflow.js        workflow 解析
  route.js                   UserPromptSubmit 路由入口
  score-skills.js            skill 打分与选择
  skill-frontmatter.js       skill frontmatter 读写辅助
scripts/                     离线维护与迁移脚本
tests/                       Node 原生测试
```

## 环境要求

- Node.js 18+
- Claude Code 插件运行环境
- 可写的 `CLAUDE_PLUGIN_DATA` 目录

当前仓库没有 TypeScript 构建链路，直接使用 Node ESM 运行。

## 安装与本地运行

### 1. 安装依赖

当前仓库没有外部 npm 依赖，克隆后可直接运行测试和脚本。

```bash
npm test
```

### 2. 设置插件数据目录

`router/init.js`、`router/route.js` 和离线脚本都依赖 `CLAUDE_PLUGIN_DATA`：

```bash
export CLAUDE_PLUGIN_DATA=/tmp/claude-skill-router-data
```

### 3. 初始化 registry 与默认数据

```bash
node router/init.js
```

初始化后会生成最小数据目录：

```text
${CLAUDE_PLUGIN_DATA}/
├── .initialized
├── config/router-config.json
├── registry/skills.json
├── registry/tags-index.json
├── registry/hash-index.json
├── stats/stats.json
├── taxonomy/tags.json
└── workflows/workflows.json
```

### 4. 本地测试一次路由

`router/route.js` 需要同时设置 `CLAUDE_PLUGIN_DATA` 和 `CLAUDE_USER_PROMPT`：

```bash
CLAUDE_USER_PROMPT="帮我排查这个报错" node router/route.js
```

输出示例是一个 hook payload，核心字段为：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "..."
  }
}
```

## Claude Code Hook 接入

当前仓库已经提供最小 hook 配置：

- `hooks/hooks.json:3` 在 `SessionStart` 调用 `router/init.js`
- `hooks/hooks.json:13` 在 `UserPromptSubmit` 调用 `router/route.js`

当前 hook 配置内容对应：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/router/init.js"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/router/route.js"
          }
        ]
      }
    ]
  }
}
```

## 可用命令

### 测试

```bash
npm test
node --test
```

### 索引维护

```bash
npm run rebuild-index
npm run validate-registry
npm run summarize-routing-log
```

### 迁移脚本

```bash
node scripts/migrate-managed-mode.js
node scripts/restore-compatibility-mode.js
```

说明：

- `rebuild-index`：重新扫描 live skill 文件并刷新 registry
- `validate-registry`：校验 `skills.json`、`tags-index.json`、`hash-index.json` 是否一致
- `summarize-routing-log`：把 `routing-log.jsonl` 汇总写回 `stats/stats.json`
- `migrate-managed-mode`：为可处理的 skill frontmatter 增加 `disable-model-invocation: true`
- `restore-compatibility-mode`：仅移除上面的 managed-mode 标记

## 当前信任边界

这是当前 MVP 最重要的实现约束之一：

- 全局 skill 与项目内 skill 都可以参与匹配
- 只有 `~/.claude/skills/` 下的可信全局 skill，才允许在高置信度下把 skill 正文注入 `additionalContext`
- 项目内 skill 即使匹配成功，也只能注入 metadata 级别摘要
- 如果 registry 丢失、日志写入失败、workflow 数据损坏，路由会尽量 **fail open**，避免阻塞主流程

相关实现可参考：

- `router/route.js:20`
- `router/route.js:36`
- `router/init.js:9`
- `scripts/validate-registry.js:43`
- `scripts/summarize-routing-log.js:47`

## 测试覆盖

当前测试集中覆盖这些方向：

- 初始化与目录生成
- 单 skill 路由
- workflow 路由
- 分类与打分
- managed-mode 迁移/回滚
- registry 校验
- routing log 汇总

测试文件：

- `tests/init.test.js`
- `tests/route.test.js`
- `tests/classify-tags.test.js`
- `tests/score-skills.test.js`
- `tests/managed-mode.test.js`
- `tests/evaluation.test.js`

## 已知限制

- 仍是 Compatibility Mode MVP，不是完整产品版
- 目前分类与打分仍是规则驱动，没有引入 embedding / 语义检索
- 当前 taxonomy、stats、workflow 默认配置都保持最小实现
- `validate-registry` 目前以 stdout 输出结果为主，尚未演进为更完整的 CI 契约
- 暂无 lint / build pipeline，运行方式以直接 Node 执行为主

## 后续方向

建议优先级大致如下：

1. 继续强化 Compatibility Mode 的可观测性与自动化校验
2. 明确 `validate-registry` 在 CI 中的退出码契约
3. 评估更丰富的 workflow 覆盖面
4. 在保持 trust boundary 的前提下推进 Managed Routing Mode
5. 引入更强的语义检索与评估数据集

## 设计文档

完整设计说明仍以以下文档为主：

- `docs/Claude Code Skill Router Plugin 最终实施文档.md`

如果你要继续扩展这个仓库，建议先阅读：

- `CLAUDE.md`
- `AGENTS.md`

这两个文件描述了当前仓库对 Claude Code 与其他 coding agents 的协作约束。
