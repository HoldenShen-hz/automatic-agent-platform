# Current Todo List

## 1. Purpose

This file maintains the execution checklist for "what to do next" and "what is still unfinished."

It serves short-cycle advancement while maintaining a full index of incomplete items. The difference from `project_progress_tracker.md` is:

- `project_progress_tracker.md` looks at overall progress
- This file looks at recent todos, in-progress items, and blockers

## 2. Usage Rules

- The top section keeps items most relevant to the current 1 to 2 iterations.
- The bottom section maintains a full index of incomplete items, preventing items from being left out of the backlog.
- Completed items should be promptly moved to the "recently completed" section and not kept indefinitely.
- If an item has been blocked for more than one iteration, the blocker must be documented.
- Do not maintain todos redundantly in historical assessment documents; maintain them only in this file.
- Work package IDs, phases, and batches in this file must be consistent with `implementation_plan.md`, `development_sequence_roadmap.md`, and `project_progress_tracker.md`.

Status enumeration:

- `[todo]`
- `[doing]`
- `[blocked]`
- `[done]`

Status semantics:

| Status | Meaning |
|--------|---------|
| `[todo]` | Has entered the current phase or subsequent planned batch, but not yet started |
| `[doing]` | Currently being implemented |
| `[blocked]` | Started but blocked |
| `[done]` | Completed and progress has been written back to the tracker |

Last updated:

- `2026-04-12` (full regression re-closed to `npm test` `2383/2383` all green, `npm run build` and `npm run typecheck` pass. Fixed `HttpApiServer` export contract, runtime transition service disconnection, tool parameter security correction, turn-scoped fallback, storage backend factory/CLI test drift, stable release disaster recovery playbook judgment, quota sampling time window drift, and subsequent reference/gap absorption introduced process guard flake and phase1b repo-map assertion drift. Current real incomplete main line returns to `P1A-EVID-72` and industrial-grade items requiring external infrastructure integration.)
- `2026-04-12a` (continued absorbing high-priority work from `system_gap_analysis_20260412.md` / `system_gap_analysis_20260412a.md`: production build and test build separation, stable CLI factory consolidation, provider/gateway default URL and shared helper deduplication, `safeLoadDivisionRegistry()` deduplication, `DurableEventBus.dispose()` lifecycle completion, single-file `core/` directory supplementary barrel, research analysis index and documentation relative path cleanup; this round continued completing `model-routing / memory` env loader consolidation, and switched `diagnostics / takeover / channel-gateway / ops-program / enterprise-governance / release-pipeline` to `withCliStorage()` / `withCliStorageAsync()`. Currently `src/cli` only has `stable-runner-factory.ts` this helper retaining direct `process.env` reads; storage startup templates only have `api-server` this class of long-lifecycle special cases remaining.)
- `2026-04-13` (continued completing `I-74 / I-79` current revision executable slice: event bus main payload continued typed, `src/core/stability/` has become the stability tools canonical namespace, source code and test imports migrated. Absorbed `reference_cache_orchestration_skeleton / reference_agent_team / reference_weaker_llm_agent / reference_agent_evolution / reference_memory_manage`, added cache orchestration, staged agent team, validation-repair loop, memory plane and other capabilities; specific adoption and reasons for not copying verbatim are in `reviews/reference_20260413_system_alignment_review.md`.)

## 3. Current Todo Summary

| Work Package ID | Item | Phase | Batch | Priority | Status | Done | Notes |
|----------------|------|-------|-------|----------|--------|------|-------|
| `CORE-01` | Implement real LLM inference call loop | `Core` | `Critical` | `P0` | `[done]` | `Yes` | phase1a has integrated UnifiedChatProvider, runPhase1AHappyPath changed to async, LLM calls execute outside provideContext, support Anthropic/OpenAI/MiniMax |
| `CORE-02` | Complete Anthropic/OpenAI provider implementation | `Core` | `Critical` | `P0` | `[done]` | `Yes` | Implemented AnthropicChatService and OpenAIChatService, including streaming/non-streaming, credential failover, error handling |
| `CORE-03` | Middleware chain model call real wiring | `Core` | `Critical` | `P0` | `[done]` | `Yes` | ModelCallProviderService has registered wrapModelCall hook, initializeModelCallProvider completes provider initialization |
| `CORE-04` | PG advisory lock implementation | `Industrial` | `P0` | `P0` | `[done]` | `Yes` | Implemented PgAdvisoryLockAdapter, using pg_try_advisory_lock/pg_advisory_unlock, including async variants, reentrant acquire, TTL extend, forceSteal |
| `P1A-EVID-72` | 72h long-duration evidence collection | `Phase 1a` | `in_progress` | `P0` | `[doing]` | `No` | Currently the main line; must complete before phase sign-off |
| `IND-P0-01` | PostgreSQL production-readiness -- remaining items require external infrastructure | `Industrial` | `P0` | `P0` | `[doing]` | `No` | Auth/gateway/coordinator HA foundation in place; true multi-coordinator HA still in selection foundation |
| `IND-P0-05` | Secret management -- secret registry, usage audit, rotation events, env-backed provider seam, integrated into deployment-execution and release pipeline | `Industrial` | `P0` | `P0` | `[doing]` | `No` | |
| `IND-P0-09` | Release pipeline -- publish execute, release bundle/export ledger, release execution ledger, workflow receipt audit baseline | `Industrial` | `P0` | `P0` | `[doing]` | `No` | |
| `IND-P0-10` | Deployment execution -- environment overlay, deployment matrix, secret/config injection plan, deployment execution/promotion history ledger, workflow receipt audit, release execute chained trigger deployment | `Industrial` | `P0` | `P0` | `[doing]` | `No` | |
| `IND-P1-01` | Enhanced DB connection pooling and failover | `Industrial` | `P1` | `P1` | `[todo]` | `No` | |
| `IND-P1-02` | Queue consumer lag monitoring | `Industrial` | `P1` | `P1` | `[todo]` | `No` | |
| `IND-P1-03` | Prompt/model/policy governance | `Industrial` | `P1` | `P1` | `[todo]` | `No` | |
| `IND-P1-04` | Enterprise governance reporting | `Industrial` | `P1` | `P1` | `[todo]` | `No` | |
| `IND-P1-05` | Incident handoff persistence | `Industrial` | `P1` | `P1` | `[todo]` | `No` | |
| `IND-P1-06` | Schema compatibility gate | `Industrial` | `P1` | `P1` | `[todo]` | `No` | |
| `IND-P1-07` | SBOM and dependency policy scan | `Industrial` | `P1` | `P1` | `[todo]` | `No` | |
| `IND-P1-08` | Channel gateway adapter (Telegram/Slack/webhook) | `Industrial` | `P1` | `P1` | `[todo]` | `No` | Already has executable baseline |
| `IND-P1-09` | API key to bearer token exchange with JWT/RBAC | `Industrial` | `P1` | `P1` | `[todo]` | `No` | Already has executable baseline |
| `IND-P1-10` | Coordinator load balancing | `Industrial` | `P1` | `P1` | `[todo]` | `No` | Currently still in selection foundation, not true multi-coordinator HA |
| `MEM-03` | Structured long-term memory schema | `Phase 2b` | `P2` | `P2` | `[todo]` | `No` | Unified workContext / topOfMind / recentHistory / longTermBackground / facts[] structure |
| `MEM-04` | Experience caching layer | `Phase 2b` | `P2` | `P2` | `[todo]` | `No` | Similar tasks can reuse few-shot and strategy experience |
| `MEM-06` | Memory retrieval with FTS5/embedding | `Phase 2b` | `P2` | `P2` | `[todo]` | `No` | FTS5/keyword recall first, then embedding/rerank |
| `CODE-01` | Semantic Repo Map | `Phase 2c` | `P2` | `P2` | `[todo]` | `No` | Upgrade to tree-sitter/AST/definition reference graph/relevance-ranked semantic Repo Map |
| `TOOL-33` | On-demand tool discovery | `Phase 2c` | `P2` | `P2` | `[todo]` | `No` | Tool recommend / deferred loading / tool_search |
| `TOOL-37` | Structured user question tool | `Phase 2c` | `P2` | `P2` | `[todo]` | `No` | Single-select / multi-select / batch questions with skipped semantics |
| `TOOL-38` | Session-level todo view for long tasks | `Phase 2c` | `P2` | `P2` | `[todo]` | `No` | todo_write tool with pending/in_progress/completed/cancelled |

## 4. Current Sprint Goals

1. Complete `P1A-EVID-72` 72h long-duration evidence collection as the current main line.
2. During the evidence run, advance `IND-P0-09`, `IND-P0-10`, `IND-P0-05` in parallel (container/CI, multi-environment deployment, and secret management baselines), but must not skip continuous observation and documentation updates for the evidence task.
3. After `P1A-EVID-72` completes, immediately enter the industrial-grade `IND-P0` main line, rather than claiming the system is fully complete.
4. After closing `IND-P0`, proceed to `IND-P1`, then `IND-P2`.
5. New implementations should prioritize entering industrial-grade P0/P1/P2 program, rather than reverting to completed Hermes Delta work packages.
6. Each work package must go through: `build -> targeted unit/integration -> sandbox/security -> npm test -> documentation update`. Partial implementation without regression is not acceptable.

## 5. Full Industrial-Grade Program Summary

### IND-P0 Remaining Items (require external infrastructure)

| Item ID | Description | Priority |
|---------|-------------|----------|
| `IND-P0-02` | PostgreSQL production-ready and distributed locks | P0 |
| `IND-P0-03` | Redis production-ready and distributed locks | P0 |
| `IND-P0-04` | Secret management infrastructure | P0 |
| `IND-P0-06` | SLO alerting infrastructure | P0 |
| `IND-P0-07` | Containerization and CI/CD | P0 |
| `IND-P0-08` | Multi-environment deployment | P0 |

### IND-P1 Remaining Items

| Item ID | Description | Priority |
|---------|-------------|----------|
| `IND-P1-01` | Enhanced DB connection pooling and failover | P1 |
| `IND-P1-02` | Queue consumer lag monitoring | P1 |
| `IND-P1-03` | Prompt/model/policy governance | P1 |
| `IND-P1-04` | Enterprise governance reporting | P1 |
| `IND-P1-05` | Incident handoff persistence | P1 |
| `IND-P1-06` | Schema compatibility gate | P1 |
| `IND-P1-07` | SBOM and dependency policy scan | P1 |
| `IND-P1-08` | Channel gateway adapter (Telegram/Slack/webhook) | P1 |
| `IND-P1-09` | API key to bearer token exchange with JWT/RBAC | P1 |
| `IND-P1-10` | Coordinator load balancing | P1 |

### IND-P2 Remaining Items

| Item ID | Description | Priority |
|---------|-------------|----------|
| `MEM-03` | Structured long-term memory schema | P2 |
| `MEM-04` | Experience caching layer | P2 |
| `MEM-06` | Memory retrieval with FTS5/embedding | P2 |
| `CODE-01` | Semantic Repo Map | P2 |
| `TOOL-33` | On-demand tool discovery | P2 |
| `TOOL-37` | Structured user question tool | P2 |
| `TOOL-38` | Session-level todo view for long tasks | P2 |

## 6. Relations to Other Documents

- Overall implementation sequence: see `implementation_plan.md`
- Development batch order: see `development_sequence_roadmap.md`
- Module completion criteria: see `module_acceptance_criteria_matrix.md`
- Current coding entry gate: see `../reviews/coding_entry_gate_review.md`
- Project status: see `project_progress_tracker.md`
