# Performance Test Directory

Performance tests and benchmarks must be explicit about workload, baseline, and acceptance criteria.

## Rules

- Keep synthetic performance tests under `tests/performance/`.
- Archive old or replaced performance suites outside the active test path or document why they remain.
- Use deterministic workloads where possible.
- Record baseline source, machine assumptions, and acceptable variance.

## Evidence

Performance regressions should include the command, dataset/workload, baseline, current result, and variance.
