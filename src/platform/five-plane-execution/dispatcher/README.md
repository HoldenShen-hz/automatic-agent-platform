# Dispatcher Boundary

This directory owns execution ticket admission, dispatch selection, backpressure snapshots, queue availability checks, and async dispatch facades.

## Rules

- Admission decisions must be deterministic and auditable.
- Queue adapter behavior belongs in queue-specific modules, not dispatcher policy.
- Dispatch async wrappers should preserve the sync service contract and observable ordering.
