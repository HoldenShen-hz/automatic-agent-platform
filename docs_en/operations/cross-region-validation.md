# Cross-Region Validation

## Goal
- Validate active/passive or active/active failover across two Kubernetes regions with PostgreSQL replication.

## Checklist
1. Provision primary and secondary clusters from the multi-region Terraform environment.
2. Verify traffic can be shifted independently to each region.
3. Confirm PostgreSQL replication lag stays within the documented SLO.
4. Simulate primary-region failure and measure recovery time objective.
5. Restore the primary region and verify selectors, DNS, and data consistency converge.

## Pass Criteria
- Secondary region serves traffic within five minutes of primary failure.
- Replication lag stays within the documented threshold.
- No conflicting lease owners or duplicated workflow progression after failback.
