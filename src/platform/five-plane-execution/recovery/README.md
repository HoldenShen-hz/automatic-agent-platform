# Runtime Recovery Boundary

This directory owns recovery candidate discovery, decision application, replay reports, dead-letter handling, and recovery views.

## Rules

- Recovery decisions must use a transaction-consistent execution snapshot.
- Replay reports should read persisted checkpoint artifacts when available.
- Decision and action events must include enough context to reconstruct the recovery path.
- New recovery behavior should be covered by targeted recovery tests, not only broad runtime tests.
