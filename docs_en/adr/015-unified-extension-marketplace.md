# ADR-015 Skill vs Plugin isno收敛为单市场

---

## OAPEFLIR 关联

本文档defines OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：信号采集vs统一 DTO
- **Assess**：执lines前/后评估vs风险判断
- **Plan**：显式规划vs DAG 构建（ADR-060）
- **Execute**：步骤执linesvs Dual-Channel 输出
- **Feedback**：信号收集、预handlevs 7 class反馈源（ADR-079）
- **Learn**：模式检测vs知识提取（ADR-080）
- **Improve**：改进候选评估vs Rollout Status机（ADR-075）
- **Release**：六级受控发布vs自动回滚

---

- Status：Accepted
- Decision日期：2026-04-03

## Background

系统历史材料里曾分别出现 Skill Marketplace、Plugin Marketplace、模板市场等多个扩展入口。如果这些概念长期并存，会导致：

- 安装vspermission治理入口分散
- 审核、签名、版本兼容vsdisabled策略repeats建设
- user难以理解“到底去哪里找扩展”

当前阶段并不会真正实现 marketplace，但需要先冻结方向，避免后面文档继续accesses along不同市场模型发散。

## Decision

Phase 1a / 1b 不实现 marketplace。

长期方向上，Skill、Plugin、模板等扩展能力收敛为统一治理入口，而不is维护多个市场模型。

这意味着：

- 当前只保留扩展对象模型和治理 contract
- 真正进入 Phase 4 时，优先建设统一 extension marketplace

## 备选方案

### 方案 A：长期维持多个市场

优点：

- 每class扩展看起来更“贴合自身语义”。

代价：

- user心智负担重。
- 审核、permission、签名、兼容、下架、计费能力高度repeats。
- 平台治理复杂度明显上升。

### 方案 B：当前就实现统一市场

优点：

- 路径最directly。

代价：

- 明显exceeds阶段。
- 当前连内部扩展治理都尚未进入实现，提前做市场只会把平台拉重。

### 方案 C：当前Decision方案

- 当前不实现 marketplace
- 长期方向收敛为统一入口
- 先在 contract 层统一 extension object、permission 和 lifecycle

## 选择这个方案的原因

- 当前阶段最重要的is内部扩展边界，不is市场产品形态。
- 统一治理入口更符合permission、审批、签名、兼容性和计费的长期需要。
- 先冻结方向，可以阻止文档继续出现多个并列市场概念。

## 关键不variable

- Skill、Plugin、模板未来都应via过统一治理链。
- 安装单元不得bypassing ToolRegistry、Policy Engine 和permission审查。
- 即使前端展示分栏，也不代table后端要维护多个市场内核。

## 采用触发条件

在正式进入以下主题前，应继续遵守该方向：

- ecosystem extension plane
- monetization metering plane
- enterprise operations plane

## 退出条件

若未来证明：

- Skill vs Plugin 的生命cycle、风险模型、商业模式完全不同
- 统一治理带来的复杂度反而更高

则可重新开 ADR 讨论拆分，但不能在没有新Decision的情况下回到“多个市场并lines演化”。

## 实施Impact

当前文档vs后续实现要求：

- contract 和文档中尽量uses统一的 extension / installable / capability registry 语言
- Phase 1a / 1b 只做 registry、permission、安装边界，不做市场 UI 或商业化分发
- Phase 4 若开始做 marketplace，应directly从统一治理入口设计，而不is先做多套市场再合并

## 结果

优点：

- 长期治理更一致。
- user心智更简单。
- permission、签名、版本兼容和计费更容易统一。

代价：

- 需要在未来真正实现时，把不同扩展class型抽象到同一治理模型中。
- 某些class型特有能力可能需要额外的 subtype 规则，而不is完全平铺handle。

## 交叉references用

- [ADR-014 组织模型isnodirectly映射到code对象](./014-org-model-code-boundary.md)
- [ADR-005 security模型](./005-security-model.md)
- [ADR-010 商业模式](./010-commercial-model.md)

## 来源章节

- `tool_skill_plugin_contract.md`
- `ecosystem_extension_plane_contract.md`
