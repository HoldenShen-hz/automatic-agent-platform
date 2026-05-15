# Invariant Tests

Invariant tests protect architecture and safety rules that should not drift during feature work.

## Scope

- Contract and naming boundaries.
- Deny-by-default, budget-before-execute, and replay side-effect rules.
- Runtime truth, state transition, dispatcher, and recovery invariants.
- Architecture remediation checks that prevent regressions in documented boundaries.

## Rules

- Each invariant test should name the rule it protects.
- Prefer deterministic file-system or source-structure checks over broad integration setup.
- When an invariant intentionally changes, update the related contract, ADR, or review evidence in the same change.

## Validation

Run the affected invariant test directly:

```bash
./node_modules/.bin/tsx --test tests/invariants/<name>.test.ts
```
