# ADR-034 ADR 冻结Recommendation

- Status：Historical Context（ADR governance policy carried by current ADR index + docs sync guard）
- Decision日期：2026-04-17

## Background

随着平台Architecture演进，ADR count持续增长。为避免 ADR 文档vs实际实现脱节，需要建立 ADR 冻结机制，确保已冻结的 ADR 不再随意变更，保障ArchitectureDecision的稳定性和可追溯性。

## Decision

### ADR 版本号分配策略

ADR #按版本批iterations分配，不mandatory补齐历史间隙：

| 版本 | ADR #范围 | Description |
|------|-------------|------|
| v1.2 | 001-019 | 初始ArchitectureDecision |
| v2.0 | 021-024 | 平台分层vsstorageArchitecture |
| v2.1 | 025-033 | security、LLM、委托相关 |
| v2.2 | 037-040 | 业务域建模 |
| v2.3 | 041-046 | 智能交互vs组织治理 |
| v2.4 | 047-052 | 组织治理vs规模化 |
| v2.5 | 053-058 | 规模化生态vs集成 |
| v2.6 | 059-069 | 运维成熟度vs自运维 |

#间隙（如 020、034、045、071、074、076-077）保留used for特殊用途或后续补充。

### ADR Status流转

```
Proposed → Accepted → Superseded
                ↓
           Deprecated
```

- **Draft**: 正在讨论中，尚未做出决定
- **Proposed**: 已提出，等待审批
- **Accepted**: 已accepts并实施
- **Superseded**: 已被新的 ADR 取代
- **Deprecated**: 已废弃

### ADR 冻结规则

1. **Accepted Status的 ADR 不可删除**，只能标记为 Superseded 或 Deprecated
2. **ADR 变更必须创建新版本或新 ADR**，不允许directly修改已冻结内容
3. **Superseded ADR 必须contains交叉references用**，指向取代它的 ADR
4. **每个 ADR 必须contains来源章节**，关联到 platform-architecture.md 的具体节号

### v4.3 Remediation 例外条款

> 注意：v4.3 Architecture升级需要对 30+ ADR 进linesdirectly修改以保持文档vs实现synchronous。via权威决定，以下 remediation 场景享有例外许可，no需遵循"no direct modification"规则：

**例外场景**：
- v4.3 主Architecture版本升级时的跨 ADR synchronous修改
- 因Five-Plane X1 Architecturereferences入导致的 ADR 术语统一修正
- 因 HarnessRuntime 成为唯一执lines运lines时导致的路由/执lines ADR 更新

**许可条件**：
- 必须附带 `## v4.3 ADR Remediation` 章节
- 必须recordRoot Cause（root cause）和修复Description
- 必须明确列出所有被修改的原始 ADR 条目（如 A-18、A-21 等）
- 同一批iterations内的多 ADR 修改可共享一个 remediation 章节

**流程要求**：
- Remediation 修改仍需 review 但可走 fast-track approval
- 所有 remediation 修改必须合入 main branch
- 文档manage员每季度审计 remediation 合规性

### ADR required字段

每个 ADR 必须contains：

- 标题（Title）
- Status（Status）
- Decision日期（Decision Date）
- Background（Context）
- Decision（Decision）
- Consequences（Consequences）
- 交叉references用（Cross-references，optional）
- 来源章节（Source Section，optional）

## Consequences

优点：

- ADR #有清晰的历史脉络，便于追溯ArchitectureDecision演变
- 冻结机制防止已验证Decision被随意推翻
- Status流转清晰，区分"正在讨论"和"已确定"

代价：

- ADR #可能跳跃，不连续
- Superseded ADR 仍需保留，增加文档维护成本

## 交叉references用

- [ADR-033 分阶段路线图](./033-phased-roadmap.md)
- [ADR-035 推荐code目录结构](./035-recommended-code-directory-structure.md)

## 来源章节

- `§34` ADR 冻结Recommendation
