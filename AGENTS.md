# AGENTS.md

This file provides repository guidance for coding agents working in this project, including Claude Code, Codex, and similar tools.

## Current repository state

- This repository is currently documentation-first.
- The main design source is `docs/Claude Code Skill Router Plugin 最终实施文档.md`.
- There is currently no `package.json`, no `tsconfig*.json`, no test directory, and no repository README.
- Do not invent build, lint, or test commands. If implementation files are added later, update this file with the real commands.

## Planning workflow

- For implementation or other multi-step work, use `/planning-with-files` to manage progress.
- Keep `task_plan.md`, `findings.md`, and `progress.md` in the repository root while work is in progress.
- Use `task_plan.md` for phases and verification, `findings.md` for discoveries, and `progress.md` for execution history.
- Re-read the planning files before major decisions on longer tasks.

## Local files that must not be committed

Treat the following as local process artifacts, not project deliverables:

- `task_plan.md`
- `findings.md`
- `progress.md`
- `.omc/`
- `docs/`
- `.DS_Store`

## Coding discipline

When editing or implementing code in this repository, follow `/karpathy-guidelines`:

- think before coding and surface assumptions early
- prefer the minimum implementation that solves the task
- make surgical changes instead of adjacent cleanup
- define clear verification criteria before claiming completion

## Project purpose

This repository is intended for a **Claude Code Skill Router Plugin** that improves skill selection by routing before the model sees the full skill universe.

The intended routing flow is:

1. Intercept requests in a `UserPromptSubmit` hook.
2. Classify requests into domain and task tags.
3. Search a skill registry built from `.claude/skills/` metadata.
4. Re-rank candidates using triggers, anti-triggers, workflow detection, and cost/history signals.
5. Inject only the selected skill or workflow guidance into `additionalContext`.

## Planned operating modes

### Compatibility Mode
- Keep Claude's normal skill behavior.
- Add routing hints and indexing without changing baseline skill exposure.

### Managed Routing Mode
- Managed skills use `disable-model-invocation: true`.
- Automatic selection is handled by the plugin instead of baseline model exposure.
- Manual `/skill-name` invocation remains possible.

Preserve the distinction between these two modes when implementing routing behavior.

## Big-picture architecture

The implementation document describes this target structure:

```text
.claude-plugin/plugin.json
hooks/hooks.json
router/
scripts/
schemas/
templates/
```

Expected router responsibilities:

- `router/init.js` — initialization on session start
- `router/route.js` — main routing entrypoint
- `router/classify-tags.js` — request classification
- `router/score-skills.js` — candidate scoring
- `router/resolve-workflow.js` — workflow selection
- `router/inject-context.js` — `additionalContext` creation
- `router/utils.js` — small shared helpers only

Keep these boundaries clear instead of collapsing the router into a single script.

## Data model expectations

Plugin runtime state is intended to live under `${CLAUDE_PLUGIN_DATA}`, not in the repo.

The registry is intentionally index-only:
- store skill paths and structured metadata
- do not duplicate full skill bodies
- read original `SKILL.md` files from source paths when needed

Expected metadata includes:
- `domain_tags`
- `task_tags`
- `triggers`
- `anti_triggers`
- `requires` / `recommends` / `conflicts_with`
- `risk`
- token and latency cost
- `managed_mode`
- content hash and scan timestamps

## Hook lifecycle

### `SessionStart`
Use for initialization:
- create plugin data directories
- seed default JSON files
- scan skills
- build registry and indexes

### `UserPromptSubmit`
Use for request-time routing:
- inspect the prompt
- classify tags
- retrieve and score candidates
- optionally resolve workflows
- inject `additionalContext`

The key architectural rule is that routing happens before the model handles the request.

## Commands

There are no repository-defined build, lint, or test commands yet.

The implementation document describes these future script entrypoints, which should only be used once the corresponding files exist:

```bash
node router/init.js
node router/route.js
node scripts/scan-skills.js
node scripts/rebuild-index.js
node scripts/validate-registry.js
node scripts/migrate-managed-mode.js
node scripts/restore-compatibility-mode.js
```

If a `package.json` is added later, prefer stable package scripts over raw `node` commands.

## Design constraints to preserve

- Reduce baseline token cost by avoiding broad skill exposure, not by copying skill bodies into local storage.
- Treat managed routing as selective context injection, not just better search.
- Keep the registry as an index over skill files, not a second skill store.
- Treat workflow detection as a first-class concern; some tasks should inject workflows rather than a single skill.
- Do not simplify routing quality down to tags alone if triggers and anti-triggers are part of the intended behavior.
