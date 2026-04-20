# HA Coordinator And Leader Election Contract

## 1. Scope

This contract defines primary/backup, leader election, and fault takeover boundaries under industrial-grade multi-coordinator deployment.

Related documents:

- `execution_plane_contract.md`
- `task_lease_and_fencing_contract.md`
- `enterprise_operations_plane_contract.md`

## 2. Goals

- Prevent coordinator from becoming a single point of failure.
- Ensure only one active leader is responsible for key control actions at any moment.
- Ensure leader switch does not break lease, dispatch, and recovery truth.

## 3. Key Objects

- `CoordinatorNode`
- `LeaderLease`
- `LeadershipEpoch`
- `FailoverDecision`

## 4. Rules

- Leader identity must be produced by authoritative backend and must not rely on local memory.
- Any leader switch must increment `leadership_epoch`.
- Followers must not execute actions requiring leader authority, such as global repair, queue reconciliation, or global freeze.
- Old leader must not continue writing control plane results after losing epoch.

## 5. Election Requirements

- Election mechanism at minimum supports: acquire, renew, expire, and reject old writes after preemption.
- Leader lease should be shorter than on-call recovery window but not so short as to cause frequent churn.

## 6. Closure Conclusion

The essence of HA coordinator is not "opening a few more nodes" but clearly defining control rights, epoch, and stale leader protection.
