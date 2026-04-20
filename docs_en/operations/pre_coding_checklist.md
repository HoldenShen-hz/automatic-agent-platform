# Pre Coding Checklist

## Goal

Before starting Phase 1a coding, confirm documentation, scope, contract, and implementation sequence have reached executable state.

Supplementary notes:

- This checklist is for "current revision".
- If main architecture, phase boundary, module acceptance criteria, gate scope, or new external reference conclusions are modified before coding, should first re-execute `documentation_completion_gate.md`, then check this checklist.

## Must All Be Satisfied

- [ ] `01` ~ `07` main documents have no obvious conflicts.
- [ ] `contracts/` has covered tasks, state machine, storage, Agent, approval, gateway, provider/tool, project structure.
- [ ] `event_bus_contract.md` has finalized event naming, schema registry, and StreamBridge boundary.
- [ ] `gateway_streaming_contract.md` has finalized SSE/WebSocket/Telegram fallback semantics.
- [ ] `storage_schema_contract.md` has finalized SQLite DDL, foreign key strategy, and artifact index boundary.
- [ ] Target structure for `divisions/`, `config/`, `src/` is determined.
- [ ] Phase 1a only-implemented roles, paths, and non-goals are clear.
- [ ] `reviews/document_readiness_review.md` has been reviewed as `ready`.
- [ ] `operations/operations-checklist.md` has passed current phase documentation sign-off.
- [ ] Current revision has not introduced un-signed-off architecture factual source changes after signoff.
- [ ] No P0 documentation gaps blocking Phase 1a start exist in `reviews/current_status_and_gap_analysis.md` and related special reviews.
- [ ] `operations/implementation_plan.md` has defined first batch implementation sequence.
- [ ] Acceptance criteria for current phase modules in `operations/operations-checklist.md` can be checked against.
- [ ] If current goal is first achieving "stable operation", then `operations/gap-analysis.md`, `operations/gap-analysis.md`, and `reviews/pre_stable_launch_blockers_checklist.md` have been included in current execution baseline.

## First Batch Items to Do Immediately After Start

1. Establish directory skeleton.
2. First implement core types, state machine, and storage abstraction.
3. Then implement minimum single Agent happy path.
4. Finally integrate budget guard, approval, and recovery.

## When Not Satisfied

- If field-level specifications are missing: supplement contract first, do not directly write runtime code.
- If main documents conflict: fix documentation factual source layer first.
- If review still clearly has P0 documentation gaps: clear P0 first before coding.
