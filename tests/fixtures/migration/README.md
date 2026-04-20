# Migration Fixtures

This directory contains migration snapshot fixtures and generators for testing schema upgrade and rollback paths.

## Structure

```
migration/
├── README.md                 # This file
├── generate-snapshots.ts    # Script to generate snapshot DBs at key versions
├── migration-fixtures.test.ts # Tests for migration ledger and snapshot generation
└── snapshots/               # Generated snapshot databases (not committed)
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
| v40 | 0040_session_events | Session events (current latest) |

## Generating Snapshots

```bash
npm run build
node dist/tests/fixtures/migration/generate-snapshots.js [outputDir]
```

Output is written to `snapshots/` by default (or the specified output directory).

## Running Tests

```bash
npm run test:unit -- tests/fixtures/migration/migration-fixtures.test.js
```

## What These Fixtures Are For

- **Upgrade path testing**: Start from an old snapshot, apply migrations, verify schema is correct
- **Rollback verification**: Apply migrations then verify rollback SQL works
- **Schema integrity**: Verify all expected tables/columns exist at each version
- **Contract validation**: Ensure migrations are always additive (no destructive changes)
