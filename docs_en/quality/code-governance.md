# Code Governance Rules

This document addresses long-term source code governance items that cannot be safely completed through single small patches.

## Governance Items

- Large file splitting.
- Global `console.*` replacement.
- Global `TODO/FIXME/HACK` cleanup.
- Global `any`, `as unknown as`, `@ts-ignore` cleanup.
- Deep import path governance.
- Barrel file count governance.
- Duplicate code detection and circular dependency detection.

## Closure Rules

- Specific bugs, test failures, and security defects must be closed through code fixes and targeted tests.
- Scale governance items must first record boundaries, owner, admission rules, and follow-up splitting strategy.
- It is not allowed to write "governance item registered" as "all code refactoring completed".

## New Code Admission

- New files should have single responsibility.
- New public APIs should be exposed through explicit barrel or package exports.
- New TODOs must include owner or tracking description.
- New `any` and `@ts-ignore` must include reason explanation.
- New or legacy super-large source files must use `1000` lines as default warning threshold, with audit or splitting plan added.

## Executable Audits

- `scripts/ci/audit-codebase-inventory.mjs` outputs current large files, `process.env`, `any`, `@ts-ignore`, dual type casting, and root directory temp file statistics.
- `scripts/ci/audit-review-batch-resource-contracts.mjs` verifies that code, UI, security, and documentation contracts have been implemented in this round of review.
- Duplicate code and circular dependencies are not allowed to have only manual conclusions; new governance items must include script statistics or named targeted test evidence.