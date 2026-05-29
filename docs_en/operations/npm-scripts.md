# NPM Scripts Maintenance Specification

`package.json` contains build, test, runtime, CI auxiliary, and stability-related scripts. This document is used to constrain script growth, avoiding the script area evolving into an unauditable command heap.

## Categories

- Build class: `build`, `build:*`
- Test class: `test`, `test:*`, various `tsx --test` targeted commands
- Runtime class: `doctor`, `inspect`, `dispatch-*`, worker/runtime commands
- Local debugging class: `dev:stack`, `dev:stack:stop`
- Stability and evidence class: `*:stable`, rehearsal, evidence report
- CI auxiliary class: scripts wrapping `scripts/ci/*`

## Maintenance Rules

- Only add `package.json` scripts when they will be repeatedly used by people, CI, or documentation.
- One-time logic goes into `scripts/` first, and register entry point in documentation; do not stuff long commands directly into `package.json`.
- Scripts that modify environment or produce side effects must have names explicitly expressing risk.
- When adding stability, release, or operations scripts, must synchronously update corresponding operations documents.
- Local debugging scripts must fix default ports and explicitly output log locations, avoiding "port occupied by old process but not visible".

## Verification Requirements

- When only changing scripts, run corresponding scripts or dry-run/inspection commands at minimum.
- Only require `npm test` as the sole verification method when the script itself covers full tests.

## Common Entry Points

- `npm run dev:stack`
  Purpose: One-click start local API, metrics, and Web UI, and automatically clean up old processes leftover in current repository.
- `npm run dev:stack:stop`
  Purpose: Stop local services raised by `dev:stack`.

Default addresses:

- UI: `http://localhost:5173`
- API: `http://127.0.0.1:4000`
- Metrics: `http://127.0.0.1:4001/metrics`

## Related Documents

- [operations-checklist.md](./operations-checklist.md)
- [test_coverage_baseline_gate.md](./test_coverage_baseline_gate.md)