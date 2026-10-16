# AutoClaw Context Pack — Sprint 1 — claude-code

_Generated 2026-09-09T07:31:41.053Z. Read this before you start: it grounds you in this project's real code, proven patterns, learned style, recent memory, and durable facts. These are retrieved hints, not authority — verify against the current code before relying on them._

**Tasks:** next-claude-code
**Retrieval mode:** balanced

## Grounded Context (RAG-retrieved)

**Task:** Next available work for claude-code: Auto-dispatched by orchestrator-loop. Agent claude-code is idle.

## Relevant Code from Your Project (RAG retrieved)

### .claude/rules/cross-agent-protocol.md (score: 50%)
```
# Cross-Agent Coordination Protocol — Claude Code

## Multi-Agent Team

You (Claude Code) are part of a multi-agent team. Other active agents: none detected.
All agents coordinate through the AutoClaw Orchestrator.

## Your Mailbox

Check at the START of every task and AFTER completing work:
- **Inbox**: `.autoclaw/orchestrator/comms/inboxes/claude-code/`
- **Shared**: `.autoclaw/orchestrator/comms/inboxes/shared/`

Message types: review_request, review_response, consensus_vote, task_claim,
task_complete, finding_report, question, answer.

## Send Messages

Write JSON to target inbox. Filename: `{timestamp}-{type}-claude-code.json`

- Broadcast: `.autoclaw/orchestrator/comms/inboxes/shared/`

## On Task Completion

1. Broadcast task_complete to shared/
2. Write review_request to other agen
```

### .claude/rules/cross-agent-protocol.md (score: 57%)
```
3. Check YOUR inbox for pending reviews

## Consensus

Tasks require 2/3 majority approval. Security findings require unanimous.
Write votes to `consensus/active/{task_id}-claude-code.json`.

## Scope

Check `.autoclaw/orchestrator/sprints/plan-summary.yaml` for assignments.
Stay in your assigned scope. Coordinate via messages for cross-scope changes.

## About AutoClaw (orientation)

AutoClaw is a local-first coordination, memory, and learning layer for AI coding agents. It lets multiple agents (across different IDEs/tools) work the same repo without colliding, gives the project institutional memory that survives across sessions, and serves distilled context back to each agent to cut token waste. It operates entirely through files under `.autoclaw/` plus host-native rule/steering files — 
```

### .claude/rules/cross-agent-protocol.md (score: 57%)
```
  - ✅ `/index-code` writes ONLY the vector store `.autoclaw/vector/db.sqlite`. The KG (`.autoclaw/kg/kg.db`) is written by `/learn` and the orchestrator, and it holds coordination facts, not code.
- ❌ The knowledge graph stores code symbols, dependencies, or cross-references.
  - ✅ It stores multi-agent coordination outcomes (consensus verdicts, review findings). For code relationships, use vector retrieval (`/retrieve`).
- ❌ Hand-writing your own AutoClaw steering file keeps you current.
  - ✅ AutoClaw generates and refreshes its own files (`.autoclaw/agent-style.md`, `.autoclaw/AGENT-ORIENTATION.md`, and host-native steering). Read those — a hand-authored copy is a snapshot that drifts.
- ❌ A coordination message only needs `from`, `to`, and `type`.
  - ✅ Every message MUST carry a uniqu
```

### .claude/rules/cross-agent-protocol.md (score: 50%)
```
| `/index-code` | Implemented | the VECTOR store → `.autoclaw/vector/db.sqlite` (+ `last-index.json`, `index-health.json`). **Does NOT write:** the Knowledge Graph `.autoclaw/kg/kg.db` — `/index-code` never touches the KG | Chunk + embed the workspace codebase so `/retrieve` can do semantic code search. |
| `/retrieve <query>` | Implemented | nothing (read-only) | Return the most relevant code + learning chunks for a query from the vector store. |
| `/search <query>` | Implemented | nothing (read-only) | Semantic search over distilled learnings. |
| `/metrics` | Implemented | nothing (read-only) | Show learning-run counts, kept-rate, and token usage from `.autoclaw/metrics/`. |

Do not confuse the stores:

- ❌ The indexing command is `/index`.
  - ✅ It is `/index-code`. Use the exact name 
```

### README.md (score: 36%)
```
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-
```

## Your Previously Successful Patterns

- Make focused, single-responsibility changes and verify them with tests before moving on.
- Match existing project conventions for naming, error handling, and structure.
- Read the relevant code before editing it; never change code you have not seen.

## Your Learned Agent Style Guide

## Agent Style Guide

_Generated by AutoClaw `/learn`. This file is regenerated on every run from your recent sessions — edit the source signals, not this file._

## Successful Patterns

- Make focused, single-responsibility changes and verify them with tests before moving on.
- Match existing project conventions for naming, error handling, and structure.
- Read the relevant code before editing it; never change code you have not seen.

## Patterns to Avoid

- Avoid large speculative rewrites that are not backed by tests.
- Avoid adding new dependencies when an existing project utility already covers the need.

## Preferred Tools

- general-purpose coding agent

## Project Memory Summary (recent)

## 2026-09-07T22:24:49.178Z — /learn
Analyzed 1 session(s), 0 kept signal(s) from autoclaw-native.
Successful patterns:
- Make focused, single-responsibility changes and verify them with tests before moving on.
- Match existing project conventions for naming, error handling, and structure.
- Read the relevant code before editing it; never change code you have not seen.
Patterns to avoid:
- Avoid large speculative rewrites that are not backed by tests.
- Avoid adding new dependencies when an existing project utility already covers the need.

## Instructions for the Agent

- Follow the patterns and style shown in the retrieved examples above.
- Prefer solutions that match what has been successfully kept in past sessions.
- Avoid approaches recorded under patterns to avoid.
- Match existing project conventions; read code before changing it.
- Be concise and engineering-focused; produce production-ready code.
- If the task is ambiguous, ask clarifying questions before coding.

## Durable Knowledge-Graph Facts

- *(progress)* Dispatched Next available work for claude-code (next-claude-code) to claude-code for sprint 1.
- *(observation)* Dispatched Next available work for claude-code (next-claude-code) to claude-code for sprint 1.
- *(progress)* Dispatched Next available work for claude-code (next-claude-code) to claude-code for sprint 1.
- *(observation)* Dispatched Next available work for claude-code (next-claude-code) to claude-code for sprint 1.
- *(progress)* Dispatched Next available work for claude-code (next-claude-code) to claude-code for sprint 1.
- *(observation)* Dispatched Next available work for claude-code (next-claude-code) to claude-code for sprint 1.
