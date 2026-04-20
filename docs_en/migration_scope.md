# Migration Scope From Old System To New Platform

## Sources

This scope is derived from:

- `automatic_agent_patform_arthitecture_design.md`
- `../migrate_guideline.md`
- old-system `automatic_agent_system/doc/18_code_architecture.md`

Rules:

- the new platform architecture document defines the target
- the migration guideline defines migration order and grading
- the old code architecture document is reference-only for inventory and refactor cost

## What must be migrated

The migration baseline must include these engineering assets:

- `src/core/types`
- `src/core/errors.ts`
- `src/core/config`
- `src/core/storage`
- `src/core/events`
- `src/core/cache`
- `src/core/locking`
- `src/core/queue`
- `src/core/runtime`
- `src/core/tools`
- `src/core/providers`
- `src/core/workflow`
- `src/core/approvals`
- `src/core/security`
- `src/core/observability`
- `src/core/stability`
- `src/core/ops`
- `src/core/api`
- `src/core/artifacts`
- `src/core/orchestration`
- `src/core/agent-loop`
- `src/core/planning`
- `src/core/feedback`
- `src/core/learning`
- `src/core/improvement`
- `src/core/domain-registry`
- `src/core/knowledge`
- `src/core/memory`
- `src/core/messages`
- `src/core/reliability`
- `src/core/resource`
- `src/core/results`
- `src/cli`
- `src/gateway`
- `src/plugins`
- `config/`
- `divisions/`
- `deploy/`
- `scripts/`
- `tests/unit`
- `tests/integration`
- `tests/contracts`
- `tests/reliability`
- `tests/performance`

These are not legacy design copies. They are the old system's reusable implementation assets that form the new platform baseline.

## What must be added for the new platform

The following platform-specific boundaries must exist even if the old system did not have full implementations:

- `src/core/nl-entry`
- `src/core/goal-decomposition`
- `src/core/proactive-agent`
- `src/core/autonomy`
- `src/core/dashboard`
- `src/gateway/user-portal`

## What should be migrated with adaptation

These document families still matter, but cannot be copied as-is:

- old `doc/00` to `doc/07`
- `18_code_architecture.md`
- `19_full_coverage_test_manual.md`
- `runtime-sequence.md`
- `module-inventory.md`
- `release-checklist.md`
- `doc/contracts/`
- `doc/adr/`
- `doc/guides/`
- `doc/governance/`

Adaptation rules:

- replace old-system stage and layering language with the new seven-layer platform model
- stop using `reviews/` and `archive/` as live sources of truth
- land formal new-platform docs in `docs_zh/` and `docs_en/`

## Reference-only material

These may stay in the old repository for lookup, but should not be part of the formal new-platform docs set:

- old `doc/reference/`
- old `doc/research/`
- old `system-status-matrix.md`
- competitive analysis and reference-alignment studies
- one-off gap analyses and special reviews

## Explicitly not migrated

These should not be brought into the new platform documentation set:

- old `doc/reviews/`
- old `doc/archive/`
- old `doc/operations/archive/`
- historical TODOs, progress snapshots, sign-off notes, and one-time assessment documents

## Final conclusion

This migration is not "copy the old project into a new folder."

It is:

1. migrate reusable code, config, tests, and engineering assets
2. add the platform-only modules required by the new architecture
3. migrate only still-valid specification documents
4. exclude legacy reviews, archives, and historical assessment material
