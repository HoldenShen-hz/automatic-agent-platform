# Cross-Region Validation

## Goal
- Validate active/passive or active/active failover across two Kubernetes regions with PostgreSQL replication.

## Prerequisites

- Primary and secondary Kubernetes clusters provisioned via Terraform multi-region environment
- PostgreSQL replication configured between regions
- Load balancer with health check endpoints

## Validation Steps

### Phase 1: Baseline Verification

```bash
# 1. Verify primary region health
kubectl get pods -n platform
curl -f https://primary.platform.internal/healthz

# 2. Verify secondary region health
kubectl get pods -n platform -l region=secondary
curl -f https://secondary.platform.internal/healthz

# 3. Check PostgreSQL replication status
psql -h primary.db.internal -c "SELECT * FROM pg_stat_replication;"
psql -h secondary.db.internal -c "SELECT * FROM pg_stat_replication;"
```

### Phase 2: Traffic Shift Validation

```bash
# 4. Shift 10% traffic to secondary
kubectl scale deployment platform-api --replicas=2 -n platform

# 5. Verify secondary handles load
kubectl run load-test --image=ghcr.io/bytemark/perplex -- \
  -c 50 -d 60s https://secondary.platform.internal/api/v1/status

# 6. Verify replication lag stays within SLO
psql -h primary.db.internal -c \
  "SELECT now() - pg_last_xact_replay_timestamp() AS lag;"
# Expected: lag < 30 seconds for P1 SLO
```

### Phase 3: Failover Simulation

```bash
# 7. Simulate primary failure
kubectl scale deployment platform-api --replicas=0 -n platform
kubectl cordon <primary-node>

# 8. Verify secondary takes over within RTO (5 minutes)
time curl -f https://secondary.platform.internal/healthz

# 9. Run read/write tests against secondary
psql -h secondary.db.internal -c \
  "INSERT INTO platform_events (id, type, payload) VALUES (gen_random_uuid(), 'test', '{}');"
```

### Phase 4: Failback Recovery

```bash
# 10. Restore primary region
kubectl uncordon <primary-node>
kubectl scale deployment platform-api --replicas=3 -n platform

# 11. Verify selectors and DNS converge
kubectl get pods -n platform -o wide | grep -v Terminating

# 12. Verify no conflicting lease owners
psql -h primary.db.internal -c \
  "SELECT * FROM platform_locks WHERE owner != 'primary' LIMIT 10;"

# 13. Verify data consistency
psql -h primary.db.internal -c \
  "SELECT count(*) FROM platform_events;"
psql -h secondary.db.internal -c \
  "SELECT count(*) FROM platform_events;"
# Values must match
```

## Pass Criteria

| Criteria | Threshold | Verification |
| --- | --- | --- |
| Secondary serves traffic after primary failure | <= 5 minutes | Time from `kubectl scale` to successful curl |
| Replication lag | < 30 seconds | `pg_last_xact_replay_timestamp()` |
| No conflicting lease owners | 0 conflicts | SQL query check |
| Data consistency after failback | 100% match | Row count comparison |
| Workflow progression not duplicated | No duplicates | Event sequence verification |

## Rollback Procedure

```bash
# If validation fails, rollback to primary
kubectl scale deployment platform-api --replicas=3 -n platform
kubectl label nodes <primary-node> region=primary --overwrite
curl -X POST https://primary.platform.internal/api/v1/reset-primary
```

## Evidence Collection

```bash
# Capture evidence for audit
kubectl get events -n platform --sort-by='.lastTimestamp' > events.log
psql -h primary.db.internal -c "COPY pg_stat_replication TO STDOUT;" > replication.log
```
