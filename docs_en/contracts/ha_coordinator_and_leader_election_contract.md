# HA Coordinator And Leader Election Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines工业级多 coordinator 部署下的主备、选主和故障接管边界。

相关文档：

- `execution_plane_contract.md`
- `task_lease_and_fencing_contract.md`
- `enterprise_operations_plane_contract.md`

## 2. 目标

- 避免 coordinator 成为单点。
- 保证同一时刻只有一个 active leader 负责关键控制动作。
- 让 leader 切换后不破坏 lease、dispatch 和 recovery 真相。

## 3. 关键对象

- `CoordinatorNode`
- `LeaderLease`
- `LeadershipEpoch`
- `FailoverDecision`

## 4. 规则

- leader 身份必须由 authoritative backend 产生，不relies on本地内存。
- 任何 leader 切换都必须提升 `leadership_epoch`。
- follower 不得执lines需要 leader authority 的动作，例如globally repair、queue reconciliation、globally freeze。
- 旧 leader 在失去 epoch 后不得继续写Control Plane结果。

## 5. 选主要求

- 选主机制至少supported：获取、续约、过期、抢占后拒绝旧writes。
- leader lease 应短于值班恢复窗口，但不能短到造成频繁抖动。

## 6. 收口Conclusion

HA coordinator 的本质不is“多开几个节点”，而is把控制权、epoch 和 stale leader 防护defines清楚。
