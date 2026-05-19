# Golden Test Maintenance

Golden tests protect stable output contracts such as CLI output, API response shapes, generated config, deployment manifests, and snapshot fixtures.

## Scope

- Put contract-shape tests directly under `tests/golden/`.
- Put snapshot fixtures under `tests/golden/snapshots/`.
- Keep deployment manifest golden tests under `tests/golden/deploy/`.
- Snapshot-backed tests may use either `*.golden.test.ts` or `*.test.ts`, but they must call `assertGolden*()` helpers so the storage location and update flow stay uniform.

## Update Rules

- Only update snapshots when the contract change is intentional.
- Include the source change and golden update in the same focused commit.
- Prefer deterministic IDs, timestamps, ordering, and seeded fixtures.
- Do not use golden tests to hide flaky behavior; fix nondeterminism first.

## Deploy Fixtures

- `tests/golden/deploy/` is the canonical location for deployment-manifest golden tests.
- Deployment snapshots still belong under `tests/golden/snapshots/`; `deploy/` only holds the test sources and helpers.

## Validation

Run targeted golden files instead of the full suite when changing one contract:

```bash
./node_modules/.bin/tsx --test tests/golden/<file>.test.ts
```
