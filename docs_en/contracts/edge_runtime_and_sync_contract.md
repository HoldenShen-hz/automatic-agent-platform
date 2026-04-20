# Edge Runtime And Sync Contract

## 1. Scope

This contract defines the minimal edge runtime, offline execution constraints, and synchronization protocol for `§62`.

## 2. Canonical Objects

- `EdgeRuntimeProfile`
- `OfflineExecutionRecord`
- `SyncEnvelope`
- `ConflictResolutionDecision`

## 3. `EdgeRuntimeProfile` Minimum Fields

- `edge_node_id`
- `capabilities`
- `connectivity_mode`
- `max_local_retention_hours`
- `allowed_models`
- `sync_policy`

## 4. Rules

- Edge runtime defaults to least privilege.
- Side effects produced during offline periods must be written to `OfflineExecutionRecord`.
- Reconnection sync must explicitly handle conflicts, replay, and ordering.

## 5. Test Requirements

- unit: sync envelope, conflict resolution
- integration: offline execute -> reconnect -> sync
- contract: edge nodes not satisfying sync policy must not upload restricted data