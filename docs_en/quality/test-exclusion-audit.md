# Test Exclusion Audit

`tsconfig.json` `exclude` may contain historically unstable tests, type cycles, build performance avoidance, or E2E/integration tests that should not participate in compilation. You cannot judge test failure by just "exclude is long", items must be classified one by one.

## Audit Command

```bash
node scripts/ci/audit-test-exclusions.mjs
```

Output includes:

- `totalExcludeEntries`: total tsconfig exclude count.
- `testExcludeEntries`: count of excludes matching test/e2e/integration/golden.
- `testExcludes`: list of specific exclusion items.

## Classification Rules

- Build scope exclude: does not mean tests do not run, only means not participating in main TypeScript compilation.
- Historical failure exclude: must have named tests or fix plans.
- E2E/integration exclude: should be covered by independent runner or CI job.
- Golden exclude: should be covered by golden targeted tests.

## Review Requirements

"Tests still failing" in the issue list can only be closed by named test results; "coverage governance" can be closed by audit scripts and independent runner plans.