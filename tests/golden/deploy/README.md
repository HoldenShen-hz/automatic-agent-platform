# Deploy Golden Tests

This directory holds deployment-oriented golden test sources only.

Rules:

- Put deploy snapshots under `tests/golden/snapshots/`, not alongside the tests here.
- Keep deployment manifest, rollout plan, and environment diff assertions deterministic.
- When adding a new deploy golden test, document the snapshot name in the test file and update the shared maintenance rules in `tests/golden/README.md` if the workflow changes.
