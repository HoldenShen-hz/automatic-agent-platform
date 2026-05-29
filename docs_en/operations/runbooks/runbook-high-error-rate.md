# High Error Rate Runbook

## Symptoms

- `AutomaticAgentHighErrorRate` alert triggered
- `/healthz` still accessible but 5xx ratio rising
- Operator feedback that tasks fail or API retries increase noticeably

## Diagnosis

1. Check recent `aa_error_rate:rate5m`, request volume and task execution trends in Prometheus/Grafana.
2. Check `api-server` logs to confirm routes and error codes with most failures.
3. In Kubernetes/Helm environment, use `kubectl get pods`, `kubectl logs` and platform health panels to confirm database and Redis health; `docker compose ps` only applicable for local stack.
4. Check if recent rollout, policy changes or plugin activations occurred at the same time as error spikes.

## Resolution

1. If spikes are synchronized with recent rollout, first pause or rollback candidate release.
2. If issue only concentrated in single route or plugin, first remove that path to preserve core traffic.
3. If downstream dependency degraded, switch to degraded mode and reduce non-critical traffic.
4. If root cause is saturation, scale `api-server` replicas or reduce concurrent load.

## Verification

1. Confirm 5xx ratio dropped below 5% and sustained for at least 10 minutes.
2. Verify queue backlog and task failure rate returned to baseline.
3. Only close incident after alert cleared and user-side impact stopped.