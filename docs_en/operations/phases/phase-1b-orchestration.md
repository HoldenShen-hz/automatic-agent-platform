# Phase 1b Orchestration

## 1. Objectives

Build on Phase 1a to supplement HQ-side multi-agent orchestration basics, enabling the system to perform triage, splitting, aggregation, and streaming feedback.

## 2. Entry Conditions

- Phase 1a main chain has stabilized
- Single-agent approval, recovery, budget, and event chains are closed
- Basic gateway / inspect / health are available
- Before entering 1b, passed `operations-checklist.md` current phase sign-off again

## 3. Required Scope

- `intake_router` / `workflow_planner` basic runtime (business alias: VP Operations / VP Orchestration).
- Multi-agent task splitting and dependency expression.
- SSE / streaming output for at least one gateway.
- Task board or basic status query interface.
- Two-stage context compaction and message pruning strategy.
- Edit tool fuzzy / context-anchored replacement enhancement.
- VCR replay and streaming chunk playback test enhancement.
- Debug dump, provider success rate, and backpressure degradation enhancement.

## 4. Non-Goals

- Large-scale multi-division ecosystem.
- Complex HR Agent.
- Phase 3 commercialization capabilities.
- Full execution plane multi-worker scheduling.

## 5. Key Contracts / Main Documents

- [agent_contract.md](../../contracts/agent_contract.md)
- [gateway_streaming_contract.md](../../contracts/gateway_streaming_contract.md)
- [message_parts_contract.md](../../contracts/message_parts_contract.md)
- [context_compaction_and_overflow_contract.md](../../contracts/context_compaction_and_overflow_contract.md)
- [edit_replacement_chain_contract.md](../../contracts/edit_replacement_chain_contract.md)
- [operations-checklist.md](../operations-checklist.md)

## 6. Core Deliverables

- Multi-agent orchestration minimum closed loop.
- Task status visualization or query capability.
- Streaming response chain.
- Phase 1b integration test suite.

## 7. Acceptance and Exit Criteria

- Multi-agent end-to-end success rate meets standard.
- Aggregated output and trace can be reliably traced back.
- Context compaction does not harm core task success rate.
- Fuzzy edit only takes effect when there is a unique candidate and sufficient similarity, with warnings preserved.
- Modules involved in the current phase have met the "current-phase acceptable" standards in `operations-checklist.md`.

## 8. Risks and Control Points

- Risk: Phase 1b being mistaken for a full execution plane or remote workers.
- Control: Only do minimum orchestration; do not introduce multi-worker control plane.
- Risk: Streaming output diverging from actual task state.
- Control: Streaming only expresses presentation semantics; it does not replace task/execution truth.

## 9. Hand-off to Next Phase

- 2a takes over "platform validation across multiple divisions," not secretly doing multi-division work within 1b.
- Before entering 2a, orchestration, context, and streaming stability should be fully operational.
