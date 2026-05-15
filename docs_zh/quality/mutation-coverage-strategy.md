# Mutation And Coverage Strategy

This document defines how `.c8rc.json` and `stryker.config.mjs` should be interpreted together.

## Roles

- `.c8rc.json` tracks line/branch/function coverage signals.
- `stryker.config.mjs` tracks mutation resistance for selected high-risk code.

## Scope Rules

- Mutation testing should prioritize security, dispatch, recovery, budgeting, queue, and evidence paths.
- A module can have acceptable line coverage and still require mutation coverage when it owns safety-critical decisions.
- Expanding mutation scope should be done in focused increments to keep CI time predictable.

## CI Policy

- Pull requests should run lightweight mutation checks for touched critical modules when feasible.
- Full mutation runs are allowed on scheduled or release branches.
- Coverage and mutation thresholds should be reviewed together during release readiness.
