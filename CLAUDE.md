# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current repository state

- The repository is currently documentation-first. The main source of truth is `docs/Claude Code Skill Router Plugin 最终实施文档.md`.
- There is currently no `package.json`, no `tsconfig*.json`, no test directory, no README, and no repo-local Cursor/Copilot instruction files.
- Do not assume build, lint, or test commands exist yet. If implementation files are added later, update this file with the real commands.

## Canonical design intent

This repository is for a **Claude Code Skill Router Plugin** whose goal is to improve skill selection at scale by routing before the model sees the full skill universe.

The core design from `docs/Claude Code Skill Router Plugin 最终实施文档.md` is:

1. Intercept prompts in a `UserPromptSubmit` hook.
2. Classify the request into domain/task tags.
3. Search a skill registry built from `.claude/skills/` metadata.
4. Re-rank candidates with triggers, anti-triggers, workflow detection, and cost/history signals.
5. Inject only the selected skill/workflow guidance into `additionalContext`.

The architectural point is to move from:
- **Claude sees every skill and chooses**

to:
- **The plugin chooses likely skills first, then injects only the relevant context**

## Planned runtime modes

The design defines two operating modes:

### Compatibility Mode
- Keep normal Claude skill behavior.
- Build registry/indexes and add routing hints via hooks.
- Best for incremental rollout and validating routing behavior.

### Managed Routing Mode
- Managed skills get `disable-model-invocation: true` in frontmatter.
- Claude no longer auto-loads those skill descriptions into baseline context.
- Automatic selection is performed by the plugin, while manual `/skill-name` invocation remains possible.
- This mode is the main token-optimization strategy.

When changing routing behavior, preserve the distinction between these two modes.

## Big-picture repository architecture

The implementation doc describes this target package layout:

```text
.claude-plugin/plugin.json   Plugin manifest
hooks/hooks.json             Hook registration
router/                      Runtime routing pipeline
scripts/                     Maintenance and migration scripts
schemas/                     JSON schemas for registry/config data
templates/                   Default JSON templates
```

### Router responsibilities

The `router/` area is expected to be split by responsibility rather than merged into one script:

- `init.js` — first-run/session initialization
- `route.js` — main prompt-routing entrypoint
- `classify-tags.js` — domain/task classification
- `score-skills.js` — candidate scoring
- `resolve-workflow.js` — multi-step workflow detection
- `inject-context.js` — `additionalContext` payload creation
- `utils.js` — shared helpers only

Keep these boundaries clear if code is added. The routing pipeline is the core of the system.

### Expected data model

Plugin state is designed to live under `${CLAUDE_PLUGIN_DATA}` rather than in the repo:

```text
registry/   skills.json, tags-index.json, embeddings-index.json, hash-index.json
taxonomy/   tags.json
workflows/  workflows.json
config/     router-config.json
stats/      stats.json, routing-log.jsonl
```

The registry is intentionally **index-only**:
- store skill paths and metadata
- do not duplicate full skill bodies
- read actual `SKILL.md` content from the original path when needed

That constraint is one of the main design decisions in this project.

## Skill discovery assumptions

The design assumes skill scanning across:

- `~/.claude/skills/`
- `<project-root>/.claude/skills/`
- optionally extra directories from config

Registry entries are expected to track structured metadata such as:
- `domain_tags`
- `task_tags`
- `triggers`
- `anti_triggers`
- `requires` / `recommends` / `conflicts_with`
- `risk`
- token/latency cost
- `managed_mode`
- content hash and scan timestamps

If you add scanning or registry code, keep the metadata model aligned with the implementation doc.

## Hook lifecycle

The design relies on two hook phases:

### `SessionStart`
Used for initialization:
- create plugin data directories
- seed default JSON files
- scan skills
- build registry and indexes
- mark initialization complete

### `UserPromptSubmit`
Used for request-time routing:
- inspect the user prompt
- classify tags
- retrieve candidates
- score and rank skills
- optionally resolve workflows
- inject `additionalContext`

The important architecture rule is that routing happens **before** the model handles the user request.

## Commands

## Currently available commands

There are no repository-defined build, lint, or test commands yet because there is no implementation manifest in the repo.

## Planned entrypoints from the implementation document

These commands are described by the design doc and should only be used once the corresponding files exist:

```bash
node router/init.js
node router/route.js
node scripts/scan-skills.js
node scripts/rebuild-index.js
node scripts/validate-registry.js
node scripts/migrate-managed-mode.js
node scripts/restore-compatibility-mode.js
```

If a `package.json` is later added, prefer documenting stable `npm` scripts here instead of raw `node` entrypoints.

## Planning workflow for implementation work

- When building or implementing this project, use `/planning-with-files` to manage progress.
- Keep `task_plan.md`, `findings.md`, and `progress.md` in the repo root while work is in progress.
- Treat those files as working memory for multi-step tasks: track phases in `task_plan.md`, discoveries in `findings.md`, and session/test progress in `progress.md`.
- Do not commit those planning files, the local `docs/` directory, or local `.omc/` state. They are local process-management artifacts, not project deliverables.

## Coding discipline

When editing or implementing code in this repository, apply `/karpathy-guidelines`:

- think before coding and surface assumptions early
- prefer the minimum implementation that solves the task
- make surgical changes instead of adjacent cleanup
- define clear verification criteria before claiming completion

## What to optimize for in this repo

When implementing code for this project, preserve these non-obvious design constraints from the doc:

- The router should reduce baseline token cost by avoiding broad skill exposure, not by copying or compressing all skills into local storage.
- Managed routing is about **selective context injection**, not just better search.
- The registry is an index over skill files, not a second skill store.
- Workflow detection is a first-class concern; some prompts should inject a workflow instead of a single skill.
- Routing quality depends on both positive triggers and anti-triggers. Do not simplify scoring down to tags alone unless the design is intentionally being changed.

## If you extend the repo

If implementation code is added, update this file with:
- real build/lint/test commands
- actual package layout
- any repo-local conventions introduced by README, Cursor rules, or Copilot instructions

Until then, treat the implementation document as the canonical source for architecture and intended behavior.
