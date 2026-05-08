# HA Coordinator And Leader Election Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines primary/backup, leader election, and failover boundaries under industrial-grade multi-coordinator deployment.

Related documents:

- `execution_plane_contract.md`
- `task_lease_and_fencing_contract.md`
- `enterprise_operations_plane_contract.md`

## 2. Objectives

- Prevent coordinator from becoming a single point of failure.
- Ensure only one active leader is responsible for critical control actions at any given time.
- Ensure leader switch does not break lease, dispatch, and recovery truth.

## 3. Key Objects

- `CoordinatorNode`
- `LeaderLease`
- `LeadershipEpoch`
- `FailoverDecision`

## 4. Rules

- Leader identity must be produced by authoritative backend, not relying on local memory.
- Any leader switch must increment `leadership_epoch`.
- Followers must not execute actions requiring leader authority, such as global repair, queue reconciliation, or global freeze.
- Old leader must not continue writing control plane results after losing epoch.

## 5. Election Requirements

- Election mechanism must support at minimum: acquisition, renewal, expiration, and rejection of stale writes after preemption.
- Leader lease should be shorter than on-duty recovery window but not so short as to cause frequent thrashing.

## 6. Closure Conclusion

The essence of HA coordinator is not "running multiple nodes", but clearly defining control authority, epoch, and stale leader protection.
