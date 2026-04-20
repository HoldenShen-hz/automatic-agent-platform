# HA Coordinator And Leader Election Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 rollout
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义工业级多 coordinator 部署下的主备、选主和故障接管边界。

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

- leader 身份必须由 authoritative backend 产生，不依赖本地内存。
- 任何 leader 切换都必须提升 `leadership_epoch`。
- follower 不得执行需要 leader authority 的动作，例如全局 repair、queue reconciliation、全局 freeze。
- 旧 leader 在失去 epoch 后不得继续写控制面结果。

## 5. 选主要求

- 选主机制至少支持：获取、续约、过期、抢占后拒绝旧写入。
- leader lease 应短于值班恢复窗口，但不能短到造成频繁抖动。

## 6. 收口结论

HA coordinator 的本质不是“多开几个节点”，而是把控制权、epoch 和 stale leader 防护定义清楚。
