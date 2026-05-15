# Execution Lease Boundary

This directory owns execution lease acquisition, renewal, release, and lease fencing semantics.

## Lease vs HA

- Execution leases protect task/run ownership.
- HA leadership protects service-level coordination.
- A lease may be informed by HA state, but lease validity must remain explicit and auditable.
