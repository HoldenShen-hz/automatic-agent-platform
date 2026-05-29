# High Error Rate Runbook

## Symptoms

- `AutomaticAgentHighErrorRate` alert firing
- `/healthz` remains reachable but 5xx ratio rises
- operator reports repeated task failures or API retries

## Diagnosis

1. Check recent `aa_error_rate:rate5m`, request volume, and task execution trends in Prometheus/Grafana.
2. Review `api-server` logs for the top failing route and error code.
3. In Kubernetes/Helm environments, confirm database and Redis health with `kubectl get pods`, `kubectl logs`, and the platform health dashboard. `docker compose ps` is only for local stacks.
4. Inspect whether a recent rollout, policy change, or plugin activation correlates with the spike.

## Mitigation

1. If the spike tracks a recent rollout, pause or roll back the candidate release.
2. If the spike is isolated to one route or plugin, disable that path and keep core traffic serving.
3. If downstream dependencies are degraded, switch to degraded mode and shed non-critical traffic.
4. If saturation is the cause, scale out `api-server` replicas or reduce concurrent load.

## Verification

1. Confirm 5xx ratio falls below 5% for at least 10 minutes.
2. Verify queue backlog and task failure rate return to baseline.
3. Close the incident only after the alert resolves and customer-facing impact stops.
