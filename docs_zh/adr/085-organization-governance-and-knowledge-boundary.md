# ADR-085 Organization Governance And Knowledge Boundary

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：组织结构、身份、知识边界与合规信号采集
- **Assess**：审批链路、知识共享、治理委托与合规匹配
- **Plan**：组织路由、继承 / 覆写、受控共享策略
- **Execute**：SSO、SCIM、审批路由、知识隔离、治理操作台
- **Feedback**：审批超时、访问拒绝、共享复盘
- **Learn**：组织治理规则与边界策略优化
- **Improve**：部门级合规与治理配置持续演进
- **Release**：组织治理变更分级发布

---

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

v2.7 `§46-§51` 引入组织治理层。当前仓库已有：

- `src/org-governance/org-model`
- `src/org-governance/approval-routing`
- `src/org-governance/sso-scim`
- `src/org-governance/knowledge-boundary`
- `src/org-governance/delegated-governance`

但多数目录仍是空壳 barrel，缺统一决策。

## 决策

### 1. 组织节点是治理、审批、知识和合规的共同根对象

组织模型最少支持：

- enterprise
- business_unit
- department
- team
- seat / user

### 2. 审批、合规和知识边界都遵循“继承优先、显式覆写”

默认规则从上级节点继承；
下级节点只能在授权范围内覆写。

### 3. SSO / SCIM 只负责身份同步，不直接授予业务权限

身份接入与治理授权分离，避免目录系统直接越权。

### 4. 知识共享必须显式声明边界与审计

跨部门知识访问必须带：

- sharing policy
- purpose
- approver / policy source
- access log

### 5. 治理委托必须可回收、可审计、可限定范围

治理委托不是永久转移，而是带 scope、TTL 和 revoke 的受控授权。

## 后果

- 组织治理层将成为 `tenant / division / policy / knowledge` 的统一上位边界
- 后续实现优先补组织模型、审批路由和知识边界的 contract 与状态机测试

