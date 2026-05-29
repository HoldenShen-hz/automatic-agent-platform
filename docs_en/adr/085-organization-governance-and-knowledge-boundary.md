# ADR-085 Organization Governance And Knowledge Boundary

---

## OAPEFLIR 关联

本文档defines OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：组织结构、身份、知识边界vs合规信号采集
- **Assess**：审批链路、知识共享、治理委托vs合规匹配
- **Plan**：组织路由、继承 / 覆写、受控共享策略
- **Execute**：SSO、SCIM、审批路由、知识隔离、治理操作台
- **Feedback**：审批timeout、访问拒绝、共享复盘
- **Learn**：组织治理规则vs边界策略优化
- **Improve**：部门级合规vs治理configure持续演进
- **Release**：组织治理变更分级发布

---

- Status：Accepted
- Decision日期：2026-04-20

## Background

当前权威口径对应 `docs_zh/architecture/00-platform-architecture.md` 中组织治理vs知识边界章节。当前仓库已有：

- `src/org-governance/org-model`
- `src/org-governance/approval-routing`
- `src/org-governance/sso-scim`
- `src/org-governance/knowledge-boundary`
- `src/org-governance/delegated-governance`

但多数目录仍is空壳 barrel，缺统一Decision。

## Decision

### 1. 组织节点is治理、审批、知识和合规的共同根对象

组织模型最少supported：

- enterprise
- business_unit
- department
- team
- seat / user

### 2. 审批、合规和知识边界都遵循“继承优先、显式覆写”

defaults to规则从上级节点继承；
下级节点只能在authorization范围内覆写。

### 3. SSO / SCIM 只负责身份synchronous，不directly授予业务permission

身份接入vs治理authorization分离，避免目录系统directly越权。

### 4. 知识共享必须显式声明边界vs审计

跨部门知识访问必须带：

- sharing policy
- purpose
- approver / policy source
- access log

### 5. 治理委托必须可回收、可审计、可限定范围

治理委托不is永久转移，而is带 scope、TTL 和 revoke 的受控authorization。

## Consequences

- 组织治理层将成为 `tenant / division / policy / knowledge` 的统一上位边界
- 后续实现优先补组织模型、审批路由和知识边界的 contract vsStatus机测试
