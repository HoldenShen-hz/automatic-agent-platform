# Edge Runtime And Sync Contract

## 1. Scope

This contract defines minimum edge runtime, offline execution constraints, and sync protocol for `§62`.

## 2. Canonical Objects

- `EdgeRuntimeProfile`
- `OfflineExecutionRecord`
- `SyncEnvelope`
- `ConflictResolutionDecision`

## 3. EdgeRuntimeProfile Minimum Fields

- `edge_node_id`
- `capabilities`
- `connectivity_mode`
- `max_local_retention_hours`
- `allowed_models`
- `sync_policy`

## 4. Rules

- Edge runtime defaults to minimum privilege.
- Side effects generated during offline must be written to `OfflineExecutionRecord`.
- Reconnection sync must explicitly handle conflicts, replay, and ordering.

## 5. Test Requirements

- unit: sync envelope, conflict resolution
- integration: offline execute -> reconnect -> sync
- contract: edge nodes not meeting sync policy must not upload restricted data
