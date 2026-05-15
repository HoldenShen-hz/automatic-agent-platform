# Scripts Directory Guide

This directory contains operator and CI entrypoints. Keep scripts grouped by runtime purpose and avoid adding one-off commands at the root unless they are stable operator commands.

## Layout

- `ci/`: CI-only quality gates, coverage helpers, mutation smoke scripts, and generated report helpers.
- `runtime/`: local runtime lifecycle commands such as start, stop, status, and live smoke checks.
- `bootstrap/`: seed loading and environment bootstrap helpers.
- Root-level scripts: stable operator commands that are expected to be called directly from `package.json`.

## Rules

- Prefer `npm run <name>` wrappers for commands used by humans or CI.
- Use `set -euo pipefail` in shell scripts.
- Write generated evidence under `data/`, `.tmp/`, or `/private/tmp`, never into source directories.
- Do not store secrets in script arguments, logs, or checked-in fixtures.
- Document new long-lived scripts here and in the relevant operation runbook.
