# Test Coverage Baseline Gate

## Purpose

This repository now treats coverage as a tracked engineering signal instead of a one-off percentage check.

The coverage flow provides:

- HTML, LCOV, text, and JSON summary output from `c8`
- directory-level rollups for `src/core/*`, `src/cli`, and `src/gateway`
- directory rollups that ignore files with zero executable coverage totals, reducing barrel/type noise
- a versioned baseline file that prevents silent regression
- a simple update workflow when intentional coverage reshaping happens

## Commands

- `npm run test`
  Runs the full suite, generates coverage, builds the directory report, and enforces the baseline gate.
- `npm run test:raw`
  Runs the full suite with `c8` coverage collection only.
- `npm run coverage:report`
  Generates `coverage/coverage-directory-summary.json` and `coverage/coverage-directory-summary.md` from the latest coverage summary.
- `npm run coverage:gate`
  Regenerates the directory report and compares current coverage against `.coverage-baseline.json`.
- `npm run coverage:baseline:update`
  Rebuilds the current coverage report and updates `.coverage-baseline.json`.

## Artifacts

- `coverage/index.html`
  Main HTML report from `c8`
- `coverage/lcov.info`
  LCOV output for external tooling
- `coverage/coverage-summary.json`
  machine-readable file summary from `c8`
- `coverage/coverage-directory-summary.json`
  aggregated directory coverage report
- `coverage/coverage-directory-summary.md`
  human-readable directory coverage report
- `.coverage-baseline.json`
  checked-in baseline gate configuration

## Update Policy

Update `.coverage-baseline.json` only after:

1. a trusted full `npm test` run is green
2. the change intentionally improves or legitimately reshapes coverage
3. the generated directory summary is reviewed for suspicious regressions

Do not update the baseline just to mask unexplained drops.
