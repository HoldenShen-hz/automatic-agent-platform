# Migration Fixtures

This directory contains migration snapshot fixtures and generators for testing schema upgrade and rollback paths.

## Structure

```
migration/
├── README.md                 # This file
├── generate-snapshots.ts    # Script to generate snapshot DBs at key versions
└── snapshots/               # Checked-in snapshot databases + manifest
    └── manifest.json        # Generated snapshot metadata
```

## Snapshot Versions

Snapshots are generated for these key schema versions:

| Version | Migration Name | Description |
|---------|---------------|-------------|
| v1 | 0001_phase1a_init | Initial phase1a schema (baseline) |
| v5 | 0005_remote_fallback_routing | Early worker routing migrations |
| v10 | 0010_remote_log_aggregation | Message parts + remote routing |
| v20 | 0020_perception_mvp | Billing + perception + gateway |
| v30 | 0030_workflow_dispatch_receipt_audit | Workflow dispatch + LLM eval |
| latest | Auto-derived from migration plan | Current head schema snapshot |

## Generating Snapshots

```bash
node --import tsx tests/fixtures/migration/generate-snapshots.ts [outputDir]
```

Output is written to `snapshots/` by default (or the specified output directory).

## Running Tests

```bash
node --import tsx --test tests/integration/platform/state-evidence/truth/migration-fixtures.test.ts
```

## What These Fixtures Are For

- **Upgrade path testing**: Start from an old snapshot, apply migrations, verify schema is correct
- **Rollback verification**: Apply migrations then verify rollback SQL works
- **Schema integrity**: Verify all expected tables/columns exist at each version
- **Contract validation**: Ensure migrations are always additive (no destructive changes)
