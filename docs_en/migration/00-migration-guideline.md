# Migration Boundaries: Legacy System to New Platform

## Source Documents

This boundary is defined by the following documents:

- [../architecture/00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [00-migration-guideline.md](./00-migration-guideline.md)
- Legacy system `automatic_agent_system/doc/18_code_architecture.md`

Rules:

- Platform skeleton document defines the target state
- Migration guideline defines migration sequence and phases
- Legacy code architecture document serves only as reference for existing assets and refactoring costs

## Engineering Assets That Must Be Migrated

Migration baseline must cover the following engineering assets:

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

These are not "copy the old design verbatim" — they are engineering assets from the legacy system that can be reused and form the baseline of the new platform.

## New Platform Capabilities That Must Be Added

Even if implementations are incomplete in the legacy system, the new platform must explicitly include:

- `src/core/nl-entry`
- `src/core/goal-decomposition`
- `src/core/proactive-agent`
- `src/core/autonomy`
- `src/core/dashboard`
- `src/gateway/user-portal`

## Document Families That Require Transformation Before Migration

The following content still has value but cannot be copied verbatim:

- Legacy `doc/00` through `doc/07`
- `18_code_architecture.md`
- `19_full_coverage_test_manual.md`
- `runtime-sequence.md`
- `module-inventory.md`
- `release-checklist.md`
- Legacy `doc/contracts/`
- Legacy `doc/adr/`
- Legacy `doc/guides/`
- Legacy `doc/governance/`

Transformation rules:

- Rewrite all content under the new platform's seven-layer model and current directory structure
- Stop treating `reviews/` and `archive/` as active sources of truth
- Formal documentation is now centralized in `docs_zh/` and `docs_en/`

## Materials That Are Retained for Reference Only

The following content may remain in the legacy repository for consultation but does not enter the new platform's official documentation set:

- Legacy `doc/reference/`
- Legacy `doc/research/`
- Legacy `system-status-matrix.md`
- Competitive analysis and reference alignment research
- One-time gap analyses and special reviews

## Content Explicitly Not Migrated

The following content does not enter the new platform's official documentation set:

- Legacy `doc/reviews/`
- Legacy `doc/archive/`
- Legacy `doc/operations/archive/`
- Historical TODOs, phase snapshots, sign-off records, and one-time evaluation materials

## Conclusion

This migration is not "copy the entire legacy project to a new directory."

Instead:

1. Migrate reusable code, configuration, tests, and engineering assets
2. Fill in platform-specific modules required by the new architecture
3. Migrate only normative documents that are still valid
4. Exclude historical reviews, archives, and one-time analysis materials
