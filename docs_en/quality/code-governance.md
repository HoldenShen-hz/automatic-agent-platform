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

- Specific bugs, test failures, and security defects must be closed with code fixes and targeted tests.
- Large-scale governance items must first record boundaries, owners, admission rules, and follow-up splitting strategies.
- It is not allowed to write "registered governance items" as "code has been fully refactored".

## New Code Admission

- New files should have single responsibility.
- New public APIs should be exposed from explicit barrels or package exports.
- New TODOs must include owner or tracking notes.
- New `any` and `@ts-ignore` must explain the reason.

## Executable Audits

- `scripts/ci/audit-codebase-inventory.mjs` is responsible for outputting current statistics on large files, `process.env`, `any`, `@ts-ignore`, double casting, and temporary files in the root directory.
- `scripts/ci/audit-review-batch-resource-contracts.mjs` is responsible for verifying that code, UI, security, and documentation contracts from this round of review have been implemented.
- Duplicate code and circular dependencies are not allowed to be concluded by manual verification alone; new governance items must include script statistics or targeted test evidence.