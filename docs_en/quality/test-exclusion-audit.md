# Test Exclusion Audit

`tsconfig.json` `exclude` entries may contain historically unstable tests, type cycles, build performance workarounds, or E2E/integration tests that should not participate in compilation. You cannot judge test invalidity just by "exclude is long"; entries must be classified one by one.

## Audit Command

```bash
node scripts/ci/audit-test-exclusions.mjs
```

Output includes:

- `totalExcludeEntries`: total number of tsconfig exclude entries.
- `testExcludeEntries`: count of exclude entries hitting test/e2e/integration/golden.
- `testExcludes`: list of specific exclude entries.

## Classification Rules

- Build scope exclusion: does not mean tests are not running, only that they do not participate in main TypeScript compilation.
- Historical failure exclusion: must include named tests or fix plan.
- E2E/integration exclusion: should be covered by independent runner or CI job.
- Golden exclusion: should be covered by golden targeted tests.

## Review Requirements

"Tests still failing" in the issue table can only be closed by named test results; "coverage governance" can be closed by audit scripts and independent runner plans.