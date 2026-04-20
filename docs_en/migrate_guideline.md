# Migration Guideline Summary

## Purpose

This file is the English summary entry for the migration guideline.

The detailed Chinese baseline remains in:

- `../docs_zh/migration/00-migration-guideline.md`

## Core migration rules

1. Use the new platform architecture as the target model.
2. Use the old system only as an implementation asset source.
3. Migrate reusable code, config, tests, contracts, and decisions.
4. Do not treat legacy reviews, archived notes, or historical assessments as active sources of truth.
5. Add platform-only modules required by the new seven-layer architecture instead of forcing old modules to represent them implicitly.

## Migration grading

- `A1`: direct migration
- `A2`: direct reuse with adapter/wrapper
- `B`: migration with refactor
- `C`: reference only
- `D`: archive / do not migrate

## Execution order

1. Build the baseline from reusable code and configuration.
2. Preserve tests that validate runtime, storage, workflow, providers, and security behavior.
3. Migrate only still-valid specifications into the new docs set.
4. Add missing platform boundaries for NL entry, goal decomposition, proactive agent, autonomy, dashboard, and user portal.
5. Remove or exclude legacy review/archive material from the new platform knowledge base.

## Current companion docs

- [automatic_agent_patform_arthitecture_design.md](./automatic_agent_patform_arthitecture_design.md)
- [migration_scope.md](./migration_scope.md)
