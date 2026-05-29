# ADR-011 Effect-TS isno作为核心运lines时基础

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

系统已via明确需要Status机、统一错误模型、恢复链、上下文传播、资源生命cyclemanage和后续 execution plane 演进。Effect-TS 能提供一套较完整的 effect、resource、layer 和 typed error 抽象，但同时也会明显提高团队学习成本和初期实现负担。

当前阶段的真实Issue不is“isno喜欢 Effect-TS”，而is：

- Ring 1 isno值得为未来能力提前references入更重的运lines时抽象。
- 若当前不references入，后面何时应重新评估。

## Decision

不在 Ring 1 mandatory采用 Effect-TS 作为核心运lines时基础。

当前阶段采用更轻的策略：

- TypeScript 原生 async/await 作为主执lines模型。
- contract 驱动的错误模型、Status机和 repository 边界先lines冻结。
- 为后续可能references入 Effect-TS 预留边界，但不让实现提前relies on其编程模型。

重新评估时点放在 Phase 2：

- 当多 worker、queue、复杂资源生命cycle、typed effect 组合开始明显增多时，再正式评估isnoreferences入。

## 备选方案

### 方案 A：Ring 1 立即全面采用 Effect-TS

优点：

- 错误、relies on、concurrent和资源manage模型更统一。
- 后续 execution plane 可能更平滑。

代价：

- 学习曲线陡峭。
- 初期实现、测试、调试和 onboarding 成本显著上升。
- 当前团队仍在收口平台边界，过早换抽象层会放大文档到code的翻译成本。

### 方案 B：完全排除 Effect-TS

优点：

- 初期心智负担最低。
- 实现速度最快。

代价：

- 一旦 Phase 2 复杂度显著上升，可能缺少统一的 effect / resource 模型。
- 后续若再references入，迁移成本更高。

### 方案 C：当前Decision方案

- 当前不mandatory采用
- 保留后续references入的结构性空间
- 以 contract 和边界设计替代过早的运lines时框架锁定

## 选择这个方案的原因

- 当前最重要的is先把Status、错误、事件、恢复、security这五个底座收紧。
- 这些Issue首先is边界和契约Issue，不is运lines时框架Issue。
- 过早references入 Effect-TS 会把“实现复杂度”前置到 Ring 1，而这不is当前的主风险。
- 保留后续重新评估空间，比现在directly锁死更稳妥。

## 关键不variable

- 当前code不得假设未来一定会references入 Effect-TS。
- 当前也不得把codehardcoded成“绝no可能references入 Effect-TS”的形态。
- 错误模型、repository 边界、上下文传播和Status推进入口必须独立于具体运lines时框架成立。

## 采用触发条件

若出现以下任一情况，应重新开启评估：

- execution plane 进入多 worker / queue / lease / handover 实现阶段。
- 资源生命cyclemanage开始广泛涉及 sandbox、provider、gateway、worker registry。
- 现有 async/await + service 组织方式明显导致错误传播、资源清理或relies on注入失控。

## 退出条件

若 Phase 2 评估后仍发现：

- 复杂度尚不足以证明references入收益
- 团队维护成本高于预期
- contract 和 service 已足以支撑演进

则继续维持不references入，不视为“延期failed”。

## 实施Impact

对当前实现的要求：

- 继续把核心能力收敛为 service + repository + contract。
- 用 `AppError`、transition service、policy engine、context propagation 等 contract 替代框架耦合。
- 避免在code中形成难以替换的隐式globallyrelies on。

对后续演进的要求：

- 若未来评估references入，应先用 ADR 补齐迁移范围、收益证明和回滚策略。

## 结果

优点：

- Phase 1a / 1b 的落地速度vs理解成本更可控。
- 先把平台边界做稳，再决定isno升级运lines时抽象。
- 避免把框架偏好误当成Architecture刚需。

代价：

- 当前阶段部分 typed effect、resource safety 优势暂时拿不到。
- Phase 2 若决定references入，仍需要一iterations受控迁移。

## 交叉references用

- [ADR-012 SQLite isno作为 Phase 1-2 唯一主storage](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-013 EventEmitter isno继续uses到 Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-014 组织模型isnodirectly映射到code对象](./014-org-model-code-boundary.md)

## 来源章节

- `System Improvement Roadmap / P0-10`
- `reference/16-competitive-differentiation.md`
