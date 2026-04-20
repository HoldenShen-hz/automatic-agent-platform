# ADR-011 Effect-TS 是否作为核心运行时基础

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：信号采集与统一 DTO
- **Assess**：执行前/后评估与风险判断
- **Plan**：显式规划与 DAG 构建（ADR-060）
- **Execute**：步骤执行与 Dual-Channel 输出
- **Feedback**：信号收集、预处理与 7 类反馈源（ADR-079）
- **Learn**：模式检测与知识提取（ADR-080）
- **Improve**：改进候选评估与 Rollout 状态机（ADR-075）
- **Release**：六级受控发布与自动回滚

---

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

系统已经明确需要状态机、统一错误模型、恢复链、上下文传播、资源生命周期管理和后续 execution plane 演进。Effect-TS 能提供一套较完整的 effect、resource、layer 和 typed error 抽象，但同时也会明显提高团队学习成本和初期实现负担。

当前阶段的真实问题不是“是否喜欢 Effect-TS”，而是：

- Phase 1a / 1b 是否值得为未来能力提前引入更重的运行时抽象。
- 若当前不引入，后面何时应重新评估。

## 决策

不在 Phase 1a / 1b 强制采用 Effect-TS 作为核心运行时基础。

当前阶段采用更轻的策略：

- TypeScript 原生 async/await 作为主执行模型。
- contract 驱动的错误模型、状态机和 repository 边界先行冻结。
- 为后续可能引入 Effect-TS 预留边界，但不让实现提前依赖其编程模型。

重新评估时点放在 Phase 2：

- 当多 worker、queue、复杂资源生命周期、typed effect 组合开始明显增多时，再正式评估是否引入。

## 备选方案

### 方案 A：Phase 1a 立即全面采用 Effect-TS

优点：

- 错误、依赖、并发和资源管理模型更统一。
- 后续 execution plane 可能更平滑。

代价：

- 学习曲线陡峭。
- 初期实现、测试、调试和 onboarding 成本显著上升。
- 当前团队仍在收口平台边界，过早换抽象层会放大文档到代码的翻译成本。

### 方案 B：完全排除 Effect-TS

优点：

- 初期心智负担最低。
- 实现速度最快。

代价：

- 一旦 Phase 2 复杂度显著上升，可能缺少统一的 effect / resource 模型。
- 后续若再引入，迁移成本更高。

### 方案 C：当前决策方案

- 当前不强制采用
- 保留后续引入的结构性空间
- 以 contract 和边界设计替代过早的运行时框架锁定

## 选择这个方案的原因

- 当前最重要的是先把状态、错误、事件、恢复、安全这五个底座收紧。
- 这些问题首先是边界和契约问题，不是运行时框架问题。
- 过早引入 Effect-TS 会把“实现复杂度”前置到 Phase 1a，而这不是当前的主风险。
- 保留后续重新评估空间，比现在直接锁死更稳妥。

## 关键不变量

- 当前代码不得假设未来一定会引入 Effect-TS。
- 当前也不得把代码写死成“绝无可能引入 Effect-TS”的形态。
- 错误模型、repository 边界、上下文传播和状态推进入口必须独立于具体运行时框架成立。

## 采用触发条件

若出现以下任一情况，应重新开启评估：

- execution plane 进入多 worker / queue / lease / handover 实现阶段。
- 资源生命周期管理开始广泛涉及 sandbox、provider、gateway、worker registry。
- 现有 async/await + service 组织方式明显导致错误传播、资源清理或依赖注入失控。

## 退出条件

若 Phase 2 评估后仍发现：

- 复杂度尚不足以证明引入收益
- 团队维护成本高于预期
- contract 和 service 已足以支撑演进

则继续维持不引入，不视为“延期失败”。

## 实施影响

对当前实现的要求：

- 继续把核心能力收敛为 service + repository + contract。
- 用 `AppError`、transition service、policy engine、context propagation 等 contract 替代框架耦合。
- 避免在代码中形成难以替换的隐式全局依赖。

对后续演进的要求：

- 若未来评估引入，应先用 ADR 补齐迁移范围、收益证明和回滚策略。

## 结果

优点：

- Phase 1a / 1b 的落地速度与理解成本更可控。
- 先把平台边界做稳，再决定是否升级运行时抽象。
- 避免把框架偏好误当成架构刚需。

代价：

- 当前阶段部分 typed effect、resource safety 优势暂时拿不到。
- Phase 2 若决定引入，仍需要一次受控迁移。

## 交叉引用

- [ADR-012 SQLite 是否作为 Phase 1-2 唯一主存储](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-013 EventEmitter 是否继续使用到 Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-014 组织模型是否直接映射到代码对象](./014-org-model-code-boundary.md)

## 来源章节

- `System Improvement Roadmap / P0-10`
- `reference/16-competitive-differentiation.md`
