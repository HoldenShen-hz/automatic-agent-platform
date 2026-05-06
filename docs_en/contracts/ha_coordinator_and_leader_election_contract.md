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
- **Improve**: Improvement candidate evaluation and release
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines primary/backup, leader election, and fault takeover boundaries under industrial-grade multi-coordinator deployment.

Related documents:

- `execution_plane_contract.md`
- `task_lease_and_fencing_contract.md`
- `enterprise_operations_plane_contract.md`

## 2. Goals

- Prevent coordinator from becoming a single point.
- Ensure only one active leader is responsible for critical control actions at any time.
- Ensure leader switch does not destroy lease, dispatch, and recovery truth.

## 3. Key Objects

- `CoordinatorNode`
- `LeaderLease`
- `LeadershipEpoch`
- `FailoverDecision`

## 4. Rules

- Leader identity must be produced by authoritative backend and must not depend on local memory.
- Any leader switch must increment `leadership_epoch`.
- Followers must not execute actions requiring leader authority, such as global repair, queue reconciliation, global freeze.
- Old leader must not continue writing control plane results after losing epoch.

## 5. Election Requirements

- Election mechanism must at least support: acquisition, renewal, expiration, rejection of old writes after preemption.
- Leader lease should be shorter than on-duty recovery window, but not short enough to cause frequent jitter.

## 6. Conclusion

The essence of HA coordinator is not "opening more nodes", but clearly defining control rights, epoch, and stale leader protection.
