# High Availability Boundary

This directory owns HA coordinator behavior, leadership observation, failover coordination, and high-availability runtime state.

## HA vs Lease

- HA modules decide node or service leadership and failover posture.
- Lease modules own execution/task lease ownership and renewal semantics.
- Cross-use must go through explicit service contracts; do not duplicate lease counters or leadership state.
