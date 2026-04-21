# ADR-034 ADR 冻结建议

- 状态：Accepted
- 决策日期：2026-04-17

## 背景

随着平台架构演进，ADR 数量持续增长。为避免 ADR 文档与实际实现脱节，需要建立 ADR 冻结机制，确保已冻结的 ADR 不再随意变更，保障架构决策的稳定性和可追溯性。

## 决策

### ADR 版本号分配策略

ADR 编号按版本批次分配，不强制补齐历史间隙：

| 版本 | ADR 编号范围 | 说明 |
|------|-------------|------|
| v1.2 | 001-019 | 初始架构决策 |
| v2.0 | 021-024 | 平台分层与存储架构 |
| v2.1 | 025-033 | 安全、LLM、委托相关 |
| v2.2 | 037-040 | 业务域建模 |
| v2.3 | 041-046 | 智能交互与组织治理 |
| v2.4 | 047-052 | 组织治理与规模化 |
| v2.5 | 053-058 | 规模化生态与集成 |
| v2.6 | 059-069 | 运维成熟度与自运维 |

编号间隙（如 020、034、045、071、074、076-077）保留用于特殊用途或后续补充。

### ADR 状态流转

```
Proposed → Accepted → Superseded
                ↓
           Deprecated
```

- **Draft**: 正在讨论中，尚未做出决定
- **Proposed**: 已提出，等待审批
- **Accepted**: 已接受并实施
- **Superseded**: 已被新的 ADR 取代
- **Deprecated**: 已废弃

### ADR 冻结规则

1. **Accepted 状态的 ADR 不可删除**，只能标记为 Superseded 或 Deprecated
2. **ADR 变更必须创建新版本或新 ADR**，不允许直接修改已冻结内容
3. **Superseded ADR 必须包含交叉引用**，指向取代它的 ADR
4. **每个 ADR 必须包含来源章节**，关联到 platform-architecture.md 的具体节号

### ADR 必需字段

每个 ADR 必须包含：

- 标题（Title）
- 状态（Status）
- 决策日期（Decision Date）
- 背景（Context）
- 决策（Decision）
- 后果（Consequences）
- 交叉引用（Cross-references，可选）
- 来源章节（Source Section，可选）

## 后果

优点：

- ADR 编号有清晰的历史脉络，便于追溯架构决策演变
- 冻结机制防止已验证决策被随意推翻
- 状态流转清晰，区分"正在讨论"和"已确定"

代价：

- ADR 编号可能跳跃，不连续
- Superseded ADR 仍需保留，增加文档维护成本

## 交叉引用

- [ADR-033 分阶段路线图](./033-phased-roadmap.md)
- [ADR-035 推荐代码目录结构](./035-recommended-code-directory-structure.md)

## 来源章节

- `§34` ADR 冻结建议
