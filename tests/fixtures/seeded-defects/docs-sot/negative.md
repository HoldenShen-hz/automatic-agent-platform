# Seeded negative sample: docs source-of-truth with valid references

This markdown fixture references only `src/...` paths that DO exist on
disk. The audit:docs-sot script MUST NOT report any P0 finding for the
broken-reference rule.

## Real reference

See `src/platform/index.ts` for the public entry point.

## Real schema reference

The `schemas/issue-ledger.schema.json` describes the issue-ledger shape.
