# Migration

The `migration/` directory answers only two questions: how to migrate and what to migrate.

## File Order

1. [00-migration-guideline.md](./00-migration-guideline.md)
   Migration principles, levels, absorption methods, and judgment criteria.
2. [01-migration-scope.md](./01-migration-scope.md)
   Official migration boundaries and exclusions for the new platform.
3. [e2e-workflow-state-migration.md](./e2e-workflow-state-migration.md)
   Example of migrating E2E workflow tests from legacy `insertWorkflowState()` to canonical `runMultiStepOrchestration()`.

## Usage Principles

- First judge according to the guideline, then execute according to the scope.
- When conflicting with the platform skeleton, follow `architecture/00-platform-architecture.md`.
- `docs_zh/migration/` is the sole authoritative entry point; the plural `migrations/` alias page has been removed.