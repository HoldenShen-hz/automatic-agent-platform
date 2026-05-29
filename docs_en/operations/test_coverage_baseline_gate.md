# Test Coverage Baseline Gate

## Purpose

This repository treats coverage as a continuously tracked engineering signal, not a one-time percentage snapshot.

Current coverage workflow provides:

- `c8` outputs HTML, LCOV, text, JSON summary
- Directory-oriented aggregate reports
- Directory statistics after ignoring zero-executable coverage files
- Versioned baseline to prevent silent coverage regression
- Process to repeatedly update baseline when intentionally adjusting coverage shape

## Commands

- `npm test`
  Runs full baseline, generates coverage, and executes baseline gate.
- `npm run test:raw`
  Only executes layered tests and coverage collection.
- `npm run coverage:report`
  Generates `coverage/coverage-directory-summary.json` and `coverage/coverage-directory-summary.md`.
- `npm run coverage:gate`
  Regenerates directory report and compares against `.coverage-baseline.json`.
- `npm run coverage:baseline:update`
  Updates baseline after confirming changes are reasonable.

## Artifacts

- `coverage/index.html`: HTML report
- `coverage/lcov.info`: LCOV output
- `coverage/coverage-summary.json`: c8 file-level summary
- `coverage/coverage-directory-summary.json`: Directory aggregate summary
- `coverage/coverage-directory-summary.md`: Human-readable directory report
- `.coverage-baseline.json`: Versioned gate baseline

## Update Rules

Only allowed to update `.coverage-baseline.json` when all of the following conditions are met:

1. Trusted full baseline test passes
2. Coverage change is intentional behavior, not unknown regression
3. Directory-level report reviewed, no suspicious decline

Do not use baseline updates to cover unexplained coverage decline.