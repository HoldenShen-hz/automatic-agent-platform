# Temp Cache Cleanup Review

> Maintenance date: 2026-05-27
> This file only retains current governance definition, no longer records personal machine paths or one-time scan snapshots.

## Current Cleanup Targets

- `.test-db/`: Test database artifacts
- `.audit/`: Audit output
- `.runtime/`: Local runtime artifacts
- `.aa-tool-artifacts/`: Tool execution artifacts
- `logs/`: Local log output
- `.DS_Store`: Platform无关 system files

## Current Rules

- Whether to commit is jointly decided by `.gitignore` and review/CI audit.
- Deletion actions only target reproducible artifacts, not defaulting to clean user data directories that are currently in use in the workspace.
- Documents no longer retain absolute paths and machine-specific statistics.

## Evidence Entry Points

- `.gitignore`
- [README.md](./README.md)
- [platforme-full-review-b.md](./platforme-full-review-b.md)