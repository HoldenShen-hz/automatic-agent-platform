# Checkpoints Boundary

This directory owns node/run checkpoint persistence, migration compatibility, and checkpoint replay support.

## Rules

- Checkpoint records must preserve canonical run/node identifiers.
- Migration tests should cover old and new checkpoint shapes.
- Runtime recovery should read checkpoint artifacts when building recovery views.
