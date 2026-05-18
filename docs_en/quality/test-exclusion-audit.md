# Test Exclusion Audit

`tsconfig.json` `exclude` may contain historically unstable tests, type cycles, build performance workarounds, or E2E/integration tests that should not participate in compilation. You cannot simply judge test failures by "exclude is too long"; each entry must be categorized.

## Audit Command

```bash
node scripts/ci/audit-test-exclusions.mjs
```

Output contains:

- `totalExcludeEntries`: total tsconfig exclude count.
- `testExcludeEntries`: count of excludes matching test/e2e/integration/golden.
- `testExcludes`: list of specific exclude entries.

## Classification Rules

- Build-scope excludes: do not mean tests don't run; only that they don't participate in the main TypeScript compilation.
- Historical failure excludes: must have named tests or a fix plan.
- E2E/integration excludes: should be covered by an independent runner or CI job.
- Golden excludes: should be covered by golden-directed tests.

## Review Requirements

"Tests still failing" in the issue table can only be closed by named test results; "coverage governance" can be closed by audit scripts and independent runner plans.