# Reference Document Preparation Plan

## Goal

Before starting code implementation, map all capability points in `doc/reference/` to the formal documentation system to avoid "writing rules while implementing" state.

## Currently Completed

- Reference has been mechanically split and coverage index established.
- Main documents, ADRs, reviews, operations, and governance have formed layers.
- First batch of core contracts already covers tasks, state machine, storage, approvals, gateway, provider, and project structure.
- This round's new contracts have supplemented perception, streaming, supervisor, API, artifact, observability, tool/skill/plugin, sandbox/auth, billing/tenant.

## Recommended Verification Before Coding

1. Verify `storage_schema_contract.md` and `artifact_store_contract.md` are sufficient for directly writing SQLite initial schema.
2. Verify `gateway_message_contract.md` and `gateway_streaming_contract.md` are sufficient for defining minimum channel protocol for CLI/Web.
3. Verify `perception_contract.md` and `supervisor_contract.md` have clearly written proactive mode and supervision boundaries.
4. Verify `billing_and_tenant_contract.md` only serves as long-term constraint, not bleeding into Phase 1a scope.

## Things Not to Do Now

- Do not directly write core runtime when documentation still has obvious gaps.
- Do not squeeze all long-term capabilities from reference into Phase 1a at once.
- Do not use research documents to directly replace contracts.
