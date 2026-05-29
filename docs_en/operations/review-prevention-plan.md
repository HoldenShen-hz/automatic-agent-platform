# Review Prevention Plan

> Goal: Transform recurring issues in `docs_zh/reviews/` from "discovered during manual review" to "automatically blocked before submission and in CI".
> Last updated: 2026-05-27

## 1. Problem Definition

The fact that review can scan a large number of issues at once doesn't mean review is efficient; more accurately, many constraints are still停留在"human knowledge" and have not been productized as continuous gates.

High-frequency issues focus on these categories:

- Architecture and export boundaries: deep imports, compat shim drift, public exports going the long way around.
- Type governance: `@ts-expect-error`, `@ts-ignore`, `as any`, double assertions.
- External URLs / security baselines: hardcoded third-party URLs, not going through outbound policy, incorrect test layering.
- Documentation and code drift: old paths, old scripts, old repository URLs, version/Node baseline inconsistencies.
- Test governance: duplicate test titles, spawn misplaced in unit tests, legacy parallel directory remnants.
- UI declaration drift: `Implemented/*` not matching actual backend connections, buttons without real actions.

## 2. Why Issues Are Only Exposed During Review

The root cause is not "review is too late", but "constraints have not been shifted left".

- Existing tests focus more on functional correctness, lacking structural correctness gates.
- TypeScript only guarantees type correctness, cannot automatically constrain architecture boundaries, export semantics, or documentation timeliness.
- Documentation, scripts, tests, UI manifests, and runtime exports evolve separately, lacking unified reconciliation.
- Historical compatibility layers and legacy directories accumulate over time without continuous cleanup mechanisms.
- Many issues are cross-cutting concerns that are difficult to see completely in single-file/single-PR reviews.

Conclusion:

- Review should be responsible for design trade-offs, risk judgments, and requirement deviations.
- Review should no longer bear mechanical scanning work, such as finding hardcoded URLs, finding `@ts-expect-error`, or finding duplicate test titles.

## 3. Prevention Principles

### 3.1 Shift Left

- New issues must fail locally before commit or in the first CI round.
- Do not rely on "big review table closure" as a conventional discovery method.

### 3.2 Machine First

- Any constraint that can be written as a script should not continue to rely on human memory.
- When closing each category of review issues, add a corresponding guardrail.

### 3.3 Single Source of Truth

- Architecture boundaries are in `docs_zh/contracts/`, `architecture/` and `AGENTS.md`.
- Test execution conventions are in `package.json` and `scripts/run-layered-tests.mjs`.
- Stateful UI declarations are in feature manifests; views are not allowed to say different things.

## 4. Must-Have Continuous Gates

### 4.1 P0: Complete Within One Week

- Already implemented (2026-05-27):
  - `scripts/ci/audit-type-suppressions.mjs`
  - `scripts/ci/audit-outbound-urls.mjs`
  - `scripts/ci/audit-public-entrypoints.mjs`
  - `scripts/ci/audit-duplicate-test-titles.mjs`
  - Integrated into `npm run audit:repo-hygiene`
  - Currently using "existing baseline + prohibit regression" strategy; future governance goal is not to relax the baseline, but to continuously lower it and write back to baseline
- Type suppression audit:
  - Scan for new `@ts-expect-error`, `@ts-ignore`, `as any`, `as unknown as`.
  - New additions fail by default; existing ones must be whitelisted and gradually reduced to zero.
- External URL audit:
  - Scan for `http://` / `https://` literals.
  - Only allowed in contract fixtures, README examples, and explicitly whitelisted directories.
  - Runtime code must register through outbound policy / helper.
- Top-level export audit:
  - Prohibit `src/index.ts` from directly pulling deep internal modules.
  - Only allow aggregation through public entry points like `src/platform/index.ts`, `src/sdk/index.ts`.
- Duplicate test title audit:
  - Scan for same-named `test("...")`, fail if cross-file duplicates exceed threshold.
- Documentation URL / path audit:
  - Scan for old repository URLs, absolute paths, invalid script names, invalid directory references.

### 4.2 P1: Complete Within Two Weeks

- Test layering audit:
  - Scan for `execFileSync` / `spawn` / `fork` process calls.
  - Appearing in `tests/unit/` fails by default unless explicitly whitelisted.
- UI manifest consistency audit:
  - Features marked `Implemented/Contracted` or `Implemented/Internal` must satisfy:
    - Not purely static hooks;
    - Workbench actions must have at least one real `onTrigger`;
    - No placeholder text to fake being wired.
- Large file governance audit:
  - Integrated with line count threshold scanning.
  - Exceeding threshold doesn't necessarily fail directly, but must produce audit report and require owner.
- Compat shim audit:
  - New compat entries must have consumer evidence and deprecation plan.

### 4.3 P2: Complete Within One Month

- Review root cause labeling:
  - Each review issue must be tagged, e.g., `boundary`, `typing`, `docs-drift`, `test-hygiene`, `ui-status-drift`.
  - Weekly statistics on new additions and recurrences.
- PR template governance:
  - Add checkboxes for "introduced new deep imports / new external URLs / new type suppressions / new compat shims".
- CODEOWNERS / owner assignment:
  - Architecture boundaries, documentation index, test infrastructure, UI manifests need clear owners.

## 5. Recommended New Scripts and Gate Checkpoints

Recommended to add or extend the following scripts and integrate into `npm run audit:repo-hygiene` or `npm test`:

| Script | Purpose | Recommended Integration |
|--------|---------|-------------------------|
| `scripts/ci/audit-type-suppressions.mjs` | Scan type suppressions and double assertions | `audit:repo-hygiene` |
| `scripts/ci/audit-outbound-urls.mjs` | Scan bare URLs in runtime code | `audit:repo-hygiene` |
| `scripts/ci/audit-public-entrypoints.mjs` | Scan top-level export deep imports | `audit:repo-hygiene` |
| `scripts/ci/audit-duplicate-test-titles.mjs` | Scan duplicate test titles | `audit:test-exclusions` or `audit:repo-hygiene` |
| `scripts/ci/audit-test-layering.mjs` | Check if spawn/network/filesystem operations are misplaced in unit tests | `audit:repo-hygiene` |
| `scripts/ci/audit-ui-feature-contracts.mjs` | Validate UI feature status/action/hook consistency | UI test baseline |
| `scripts/ci/audit-doc-links-and-sources.mjs` | Scan old URLs, absolute paths, invalid script references | `audit:docs-sync` |

## 6. Definition of Done Updates

A problem is only truly resolved when it simultaneously satisfies all of the following:

1. Current code/documentation/test has been fixed.
2. Has targeted verification command or evidence.
3. Same category of issues has been guarded against, preventing recurrence.

When condition 3 is not met, it can only be considered "fixed this time", not "system closed".

## 7. Standard Actions After Review

After each review session, must handle in this order:

1. Fix issues discovered in this round.
2. Categorize the top 10 high-frequency issues.
3. Select automatable items among them and add scripts.
4. Integrate scripts into CI.
5. Record in `review-closure-board.md` whether this category of issues has been gated.

Prohibited: only updating review documents without adding recurrence prevention mechanisms.

## 8. Metrics

Recommended to track weekly:

- Number of new issues in review
- Number of same-category recurrences
- Percentage of issues requiring human discovery
- Percentage of issues that have been gated
- `@ts-expect-error` / `as any` inventory
- Bare URL inventory
- Duplicate test title inventory

Target definition:

- Gradually decrease the proportion of human discovery for high-frequency mechanical issues.
- Gradually reduce review to only design and architecture judgment issues.

## 9. Repository Next Steps Order

Recommended to implement directly in this order:

1. First do the four P0 scripts: type suppressions, bare URLs, duplicate test titles, deep imports.
2. Then do the two P1 scripts: test layering and UI manifest consistency.
3. Finally integrate review labeling and owner mechanism into the process.

## 10. Related Entries

- Current review closure table: `docs_zh/reviews/platforme-full-review-b.md`
- Review status definition: `docs_zh/operations/review-closure-board.md`
- Operations main index: `docs_zh/operations/README.md`
- Lightweight tracking entry: `docs_zh/operations/operations-tracker.md`
