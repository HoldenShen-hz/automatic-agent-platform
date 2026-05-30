# Review Prevention Plan

> Goal: Convert issues that repeatedly appear in `docs_zh/reviews/` from "manually discovered during review" to "automatically blocked before submission and in CI".
> Last updated: 2026-05-27

## 1. Issue Definition

The fact that current reviews can一次性 scan out a large number of issues does not mean the review itself is efficient; more accurately, many constraints are still停留在"people know" and have not been productized as continuous gates.

High-frequency issues cluster in these categories:

- Architecture and export boundary: deep import, compat shim drift, public export circumvention.
- Type governance: `@ts-expect-error`, `@ts-ignore`, `as any`, double assertions.
- External URL / security baseline: hardcoded third-party URLs, not going through outbound policy, incorrect test layering.
- Documentation vs code drift: old paths, old scripts, old repository URLs, version/Node baseline inconsistency.
- Test governance: duplicate test titles, spawn misplaced in unit, historical parallel directory remnants.
- UI status drift: `Implemented/*` inconsistent with actual backend not connected, buttons with no real actions.

## 2. Why Issues Are Only Exposed During Review

The root cause is not "review is too late", but "constraints have not been shifted left".

- Existing tests focus more on functional correctness, lacking structural correctness gates.
- TypeScript can only ensure type correctness, cannot automatically constrain architecture boundaries, export semantics, documentation timeliness.
- Documentation, scripts, tests, UI manifests, and runtime exits evolve separately, lacking unified reconciliation.
- Historical compatibility layers and old directories accumulate long-term, lacking continuous clearing mechanism.
- Many issues are cross-cutting concerns, difficult to see fully in single file/single PR review.

Conclusion:

- Reviews should be responsible for design trade-offs, risk judgment, and requirements deviation.
- Reviews should no longer承担 mechanical scanning work, such as finding hardcoded URLs, finding `@ts-expect-error`, finding duplicate test titles.

## 3. Prevention Principles

### 3.1 Shift Left

- New issues must fail at local pre-commit or first CI round.
- Not allowed to rely on "big table review closure" as a常规 discovery method.

### 3.2 Machine First

- Any constraint that can be written as a script should no longer rely on人工 memory.
- Each time a category of review issue is closed, add corresponding guardrail.

### 3.3 Single Authoritative Source

- Architecture boundaries: see `docs_zh/contracts/`, `architecture/` vs `AGENTS.md`.
- Test execution conventions: see `package.json` and `scripts/run-layered-tests.mjs`.
- State-class UI declarations: see feature manifest, not allowing view layer each does its own thing.

## 4. Continuous Gates That Must Be Implemented

### 4.1 P0: Complete Within One Week

- Already implemented (2026-05-27):
  - `scripts/ci/audit-type-suppressions.mjs`
  - `scripts/ci/audit-outbound-urls.mjs`
  - `scripts/ci/audit-public-entrypoints.mjs`
  - `scripts/ci/audit-duplicate-test-titles.mjs`
  - Integrated into `npm run audit:repo-hygiene`
  - Currently adopting "existing baseline + prohibit regression" strategy; future governance goal is not to relax baseline but to continuously reduce and write back baseline
- Type suppression audit:
  - Scan new `@ts-expect-error`, `@ts-ignore`, `as any`, `as unknown as`.
  - Default to new = fail; existing must be allowlisted and gradually reduced to zero.
- External URL audit:
  - Scan `http://` / `https://` literals.
  - Only allow contract fixture, README examples, and explicit allowlist directories.
  - Runtime code must register through outbound policy / helper.
- Top-level export audit:
  - Prohibit `src/index.ts` from directly pulling deep internal modules.
  - Only allow through public entry aggregation like `src/platform/index.ts`, `src/sdk/index.ts`.
- Duplicate test title audit:
  - Scan same-name `test("...")`, cross-file repeats exceeding threshold = fail.
- Document URL / path audit:
  - Scan old repository URLs, personal absolute paths, invalid script names, invalid directory references.

### 4.2 P1: Complete Within Two Weeks

- Test layering audit:
  - Scan `execFileSync` / `spawn` / `fork` and other process calls.
  - Appearing in `tests/unit/` = fail by default unless explicitly allowlisted.
- UI manifest consistency audit:
  - Features marked `Implemented/Contracted` or `Implemented/Internal` must satisfy:
    - Not pure static hook;
    - Workbench action has at least one real `onTrigger`;
    - Cannot use placeholder text to pretend is wired.
- Large file governance audit:
  - Integrate line count threshold scanning.
  - Exceeding threshold does not necessarily fail directly, but must produce audit report and require owner.
- Compat shim audit:
  - New compat entries must have consumer evidence and closure plan.

### 4.3 P2: Complete Within One Month

- Review root cause labeling:
  - Each review issue must be tagged, e.g., `boundary`, `typing`, `docs-drift`, `test-hygiene`, `ui-status-drift`.
  - Weekly statistics on new and recurring counts.
- PR template governance:
  - Add check items for "introducing new deep import / new external URL / new type suppression / new compat shim".
- CODEOWNERS / owner attribution:
  - Architecture boundaries, document index, test infrastructure, UI manifest need explicit owners.

## 5. Recommended New Scripts and Gate Positions

Recommend adding or extending these scripts and integrating into `npm run audit:repo-hygiene` or `npm test`:

| Script | Purpose | Recommended Integration |
| --- | --- | --- |
| `scripts/ci/audit-type-suppressions.mjs` | Scan type suppression vs double assertions | `audit:repo-hygiene` |
| `scripts/ci/audit-outbound-urls.mjs` | Scan bare URLs in runtime code | `audit:repo-hygiene` |
| `scripts/ci/audit-public-entrypoints.mjs` | Scan top-level export deep imports | `audit:repo-hygiene` |
| `scripts/ci/audit-duplicate-test-titles.mjs` | Scan duplicate test titles | `audit:test-exclusions` or `audit:repo-hygiene` |
| `scripts/ci/audit-test-layering.mjs` | Check spawn/network/filesystem operations misplaced in unit | `audit:repo-hygiene` |
| `scripts/ci/audit-ui-feature-contracts.mjs` | Verify UI feature status/action/hook consistency | UI test baseline |
| `scripts/ci/audit-doc-links-and-sources.mjs` | Scan old URLs, absolute paths, invalid script references | `audit:docs-sync` |

## 6. Definition of Done Update

Hereafter an issue is only considered truly resolved when all of the following conditions are met simultaneously:

1. Current code/documentation/tests are fixed.
2. Have targeted verification commands or evidence.
3. Same category of issue has guardrail to prevent recurrence.

When condition 3 is not met, can only be considered "fixed this round", cannot be considered "system is closed".

## 7. Standard Actions After Review

After each review ends, must handle in this order:

1. Fix issues discovered this round.
2. Classify top 10 high-frequency issues.
3. Select automatable ones and add scripts.
4. Integrate scripts into CI.
5. Record in `review-closure-board.md` whether this category of issue has been gated.

Prohibited: only updating review documents without adding regression prevention mechanisms.

## 8. Metrics

Recommend tracking these metrics weekly:

- Review new issue count
- Same category issue recurrence count
- Percentage of issues requiring manual discovery
- Percentage of issues that have been gated
- `@ts-expect-error` / `as any` inventory
- Bare URL inventory
- Duplicate test title inventory

Target scope:

- Manual discovery proportion of high-frequency mechanical issues gradually decreases.
- Reviews gradually only have design and architecture judgment issues.

## 9. Next Steps for This Repository

Recommend directly implementing in this order:

1. First do type suppression, bare URL, duplicate test title, deep import four P0 scripts.
2. Then do test layering and UI manifest consistency two P1 scripts.
3. Finally integrate review labeling and owner mechanism into the process.

## 10. Related Entry Points

- Current review closure table: `docs_zh/reviews/platforme-full-review-b.md`
- Review status scope: `docs_zh/operations/review-closure-board.md`
- Operations main index: `docs_zh/operations/README.md`
- Lightweight tracking entry: `docs_zh/operations/operations-tracker.md`