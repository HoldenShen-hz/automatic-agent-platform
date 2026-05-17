# Buglist

This file is for tracking known test failures for historical reference. Current buglist status can be queried via `npm run test:layers:smoke`.

## Format

```markdown
## [CATEGORY] Short Description

**Root Cause:** ...
**Error:** ...
**Affected Tests:** N failures
- [list of affected test files]

**Fix Required:** ...
```

## Historical Notes

- Buglist is only for tracking; it is not a substitute for fixing actual issues.
- When a bug is fixed, remove it from buglist (do not mark as "fixed").
- If a bug requires a code change to fix, it should not appear in buglist; it should be a tracked issue.