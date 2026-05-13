# Hot Upgrade Validation

## Goal

- Prove rolling upgrades complete without request loss, orphan tasks, or split-brain coordination.

## Procedure

1. Deploy the baseline version with `deploy/scripts/deploy.sh <env> <tag> rolling`.
2. Start steady synthetic traffic against `/healthz`, `/v1/tasks`, and websocket subscriptions.
3. Execute the upgrade with a new image tag.
4. Compare baseline and post-upgrade P99 latency, error counts, active lease ownership, and websocket reconnect volume.
5. Record evidence in the release bundle.

## Pass Criteria

- Zero failed health checks during the rollout window.
- P99 latency stays below 2x baseline.
- No orphan tasks or duplicate lease holders.
- Websocket clients reconnect automatically without operator action.