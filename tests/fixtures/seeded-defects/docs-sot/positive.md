# Seeded positive sample: docs source-of-truth drift (P0)

This markdown fixture references an `src/...` path that does NOT exist
on disk, AND a `schemas/<name>.schema.json` that does NOT exist either.
The audit:docs-sot script MUST report both as P0 findings.

## Broken source reference

See `src/platform/five-plane-execution/__definitely_missing_module__.ts`
for the entry point.

## Broken schema reference

The `schemas/__definitely_missing_seed__.schema.json` describes the
required envelope shape.
