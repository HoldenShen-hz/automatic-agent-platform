# Hot-Upgrade Validation

## Goal

- Prove that during rolling upgrade, no requests are lost, no orphan tasks are left, and no split-brain coordination occurs.

## Steps

1. Deploy baseline version using `bash deploy/scripts/deploy.sh <env> <tag> rolling`.
2. Apply sustained synthetic traffic to `/healthz`, `/v1/tasks` and websocket subscriptions.
3. Execute rolling upgrade with new image tag.
4. Run `bash deploy/scripts/verify-hot-upgrade.sh <base-url>` for post-upgrade verification.
5. Compare P99 latency, error count, active lease owner and websocket reconnect count before and after upgrade.
6. Write output evidence to release bundle.

## Pass Criteria

- `healthz` zero failures during rollout window.
- P99 latency does not exceed 2x baseline.
- No orphan tasks or duplicate lease holders exist.
- Websocket clients can automatically reconnect without manual intervention.