# 平台架构设计 vs 代码实现 — 全量差距评审

> **版本**: v8.0
> **评审日期**: 2026-04-23
> **设计基线**: `docs_zh/architecture/00-platform-architecture.md` v3.2（§1-§94，约 8,000 行）
> **评审对象**: `src/` 全代码库（1,387 文件 265,020 行）
> **评审范围**: 设计文档全部章节 §1-§94 vs 代码实现完整性
> **前版说明**: v7.0 仅覆盖 UI 架构(Doc-12) vs 设计文档差距，本版升级为全代码库 vs 设计文档差距评审

---

## §1 评审方法论

### 1.1 扫描范围

| 维度       | 覆盖内容                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 设计侧     | 00-arch §5-§14（平台基础设施）、§15-§32（AI 运营层）、§37-§69（业务域/交互/治理/规模化/运营成熟度层）                                               |
| 代码侧     | `src/platform/`、`src/domains/`、`src/interaction/`、`src/org-governance/`、`src/scale-ecosystem/`、`src/ops-maturity/`、`src/sdk/`、`src/plugins/` |
| 配置与部署 | `config/`（60 文件）、`deploy/`（42 文件）                                                                                                          |
| 测试       | `tests/`（1,825 文件 440,180 行）                                                                                                                   |

### 1.2 判定标准

| 符号 | 含义     | 判定标准                                           |
| ---- | -------- | -------------------------------------------------- |
| ❌   | 完全缺失 | 设计有明确定义，代码中无对应枚举/类/模块/接口      |
| 🟡   | 部分实现 | 有相关代码但覆盖度不足（缺少子类型/子模式/子阶段） |
| ✅   | 已对齐   | 设计要求在代码中有完整实现（类型+逻辑+测试）       |

### 1.3 优先级定义

| 级别 | 定义                                           | 影响                       |
| ---- | ---------------------------------------------- | -------------------------- |
| P0   | 设计核心要求完全缺失，架构违规                 | 运行时行为与设计契约不一致 |
| P1   | 设计明确要求但实现不足（缺少子类型/枚举/模式） | 功能不完整，存在隐性风险   |
| P2   | 细节补全，不影响核心功能                       | 改善一致性和可维护性       |

---

## §2 差距总览

| 分类                     | 数量 | 说明                                  |
| ------------------------ | ---- | ------------------------------------- |
| P0（架构违规）           | 3    | 设计核心分类/等级体系在代码中完全缺失 |
| P1（明确要求但实现不足） | 7    | 设计有明确规范但代码覆盖度不足        |
| P2（细节补全）           | 3    | 次要对齐项，不影响核心功能            |
| ✅ 已对齐                | 40+  | 设计要求在代码中已完整实现            |

---

## §3 P0 — 架构违规

### P0-1: §12.1 异常事件分类体系 E1-E6 完全缺失 ❌

**设计要求**（§12.1）：

平台定义 6 类异常事件分类：

| 分类 | 名称     | 定义                       |
| ---- | -------- | -------------------------- |
| E1   | 业务异常 | 业务规则/SLA/KPI 偏离      |
| E2   | 执行异常 | Agent/Workflow 执行失败    |
| E3   | 外部依赖 | 第三方 API/服务不可用      |
| E4   | 安全异常 | 未授权访问/数据泄露/注入   |
| E5   | 数据异常 | 数据质量/一致性/完整性问题 |
| E6   | 治理异常 | 合规/审批/策略违反         |

**代码现状**：

- `src/platform/shared/observability/anomaly-detection-service.ts`（795 行）使用 `AnomalyCategory` 枚举：`spike | trend_change | level_shift`
- 这是统计检测方法分类，**不是**设计要求的业务异常事件分类
- 代码中无任何文件定义 E1-E6 枚举或等价分类
- `src/platform/state-evidence/events/` 26 个文件中均未引用 E1-E6 分类

**解决方案**：

1. 新建 `src/platform/contracts/types/anomaly-event-classification.ts`：

   ```typescript
   export enum AnomalyEventClass {
     E1_BUSINESS = "E1_BUSINESS",
     E2_EXECUTION = "E2_EXECUTION",
     E3_EXTERNAL_DEPENDENCY = "E3_EXTERNAL_DEPENDENCY",
     E4_SECURITY = "E4_SECURITY",
     E5_DATA = "E5_DATA",
     E6_GOVERNANCE = "E6_GOVERNANCE",
   }

   export interface ClassifiedAnomalyEvent {
     event_id: string;
     class: AnomalyEventClass;
     severity: UnifiedSeverity; // 见 P0-2
     source_plane: PlaneId;
     detected_at: string;
     details: Record<string, unknown>;
   }
   ```

2. 在 `anomaly-detection-service.ts` 中增加分类映射层：统计检测结果（spike/trend_change/level_shift）→ 业务分类（E1-E6），基于事件来源平面和上下文自动映射

3. 在 `src/platform/state-evidence/events/` 中更新事件发布接口，所有异常事件必须携带 `AnomalyEventClass` 字段

4. 新增测试 `tests/unit/platform/anomaly-event-classification.test.ts` 覆盖 6 类分类映射

---

### P0-2: §12.2 统一严重度等级 SEV1-SEV4 缺失 ❌

**设计要求**（§12.2）：

平台统一使用 4 级严重度：

| 等级 | 名称     | 响应时间 | 影响范围          |
| ---- | -------- | -------- | ----------------- |
| SEV1 | Critical | ≤5min    | 全平台/多租户中断 |
| SEV2 | Major    | ≤15min   | 单租户/单域中断   |
| SEV3 | Minor    | ≤1h      | 单功能降级        |
| SEV4 | Low      | ≤4h      | 非功能性/优化建议 |

**代码现状**：

代码中存在 **3 套互不兼容的严重度体系**：

| 模块                | 文件路径                                            | 枚举值                             |
| ------------------- | --------------------------------------------------- | ---------------------------------- |
| Incident Management | `src/platform/shared/observability/incident-*.ts`   | `P0 \| P1 \| P2 \| P3`             |
| Anomaly Detection   | `src/platform/shared/observability/anomaly-*.ts`    | `warning \| critical \| emergency` |
| SLO Alerting        | `src/platform/state-evidence/slo/alert-severity.ts` | `AlertSeverity` 自定义枚举         |

**解决方案**：

1. 新建 `src/platform/contracts/types/unified-severity.ts`：

   ```typescript
   export enum UnifiedSeverity {
     SEV1 = "SEV1",
     SEV2 = "SEV2",
     SEV3 = "SEV3",
     SEV4 = "SEV4",
   }

   export const SEVERITY_SLA: Record<
     UnifiedSeverity,
     { response_minutes: number; resolution_minutes: number }
   > = {
     SEV1: { response_minutes: 5, resolution_minutes: 30 },
     SEV2: { response_minutes: 15, resolution_minutes: 120 },
     SEV3: { response_minutes: 60, resolution_minutes: 480 },
     SEV4: { response_minutes: 240, resolution_minutes: 2880 },
   };
   ```

2. 为每个现有模块增加映射函数（保持向后兼容）：

   ```typescript
   // incident-severity-mapper.ts
   export function toUnifiedSeverity(
     priority: "P0" | "P1" | "P2" | "P3",
   ): UnifiedSeverity {
     const map = {
       P0: UnifiedSeverity.SEV1,
       P1: UnifiedSeverity.SEV2,
       P2: UnifiedSeverity.SEV3,
       P3: UnifiedSeverity.SEV4,
     };
     return map[priority];
   }
   ```

3. 所有跨模块事件（outbox 消息、WS 推送、审计日志）统一使用 `UnifiedSeverity`

4. 新增集成测试验证三套体系到 SEV1-4 的映射一致性

---

### P0-3: §11.8 STRIDE 威胁模型完全缺失 ❌

**设计要求**（§11.8）：

平台安全架构基于 STRIDE 六维度威胁评估：

| 维度                   | 缩写 | 设计要求的防御措施          |
| ---------------------- | ---- | --------------------------- |
| Spoofing               | S    | mTLS + JWT + Principal 验证 |
| Tampering              | T    | HMAC 签名 + 审计哈希链      |
| Repudiation            | R    | 不可否认审计日志 + 时间戳   |
| Information Disclosure | I    | Egress 控制 + Secret 加密   |
| Denial of Service      | D    | 限流 + 熔断 + 弹性伸缩      |
| Elevation of Privilege | E    | RBAC + Sandbox + Capability |

并要求维护补充威胁矩阵（threat matrix），每次安全变更需更新。

**代码现状**：

- `src/platform/control-plane/iam/` 21 文件 7,386 行：有 PolicyEngine、SandboxPolicy、EgressControl，但**无 STRIDE 枚举或威胁矩阵数据结构**
- 唯一出现 "tampering" 的位置是 `audit-integrity-checker.ts` 中的注释
- 无 `ThreatModel`、`ThreatCategory`、`ThreatAssessment` 等类型定义
- 各安全防御措施（mTLS/JWT/HMAC/限流/熔断/Sandbox）已独立实现，但未关联到统一的 STRIDE 框架

**解决方案**：

1. 新建 `src/platform/control-plane/iam/threat-model/stride-framework.ts`：

   ```typescript
   export enum StrideCategory {
     SPOOFING = "SPOOFING",
     TAMPERING = "TAMPERING",
     REPUDIATION = "REPUDIATION",
     INFORMATION_DISCLOSURE = "INFORMATION_DISCLOSURE",
     DENIAL_OF_SERVICE = "DENIAL_OF_SERVICE",
     ELEVATION_OF_PRIVILEGE = "ELEVATION_OF_PRIVILEGE",
   }

   export interface ThreatEntry {
     id: string;
     category: StrideCategory;
     asset: string;
     threat_description: string;
     mitigations: string[];
     residual_risk: "low" | "medium" | "high";
     last_reviewed: string;
   }

   export interface ThreatMatrix {
     version: string;
     entries: ThreatEntry[];
     reviewed_by: string;
     reviewed_at: string;
   }
   ```

2. 新建 `src/platform/control-plane/iam/threat-model/threat-matrix-registry.ts`：维护威胁矩阵注册表，关联现有安全组件（PolicyEngine → E，EgressControl → I，AuditIntegrityChecker → T/R，CircuitBreaker → D）

3. 新建 `config/security/threat-matrix.json`：初始威胁矩阵数据，覆盖 6 个 STRIDE 维度 × 核心资产

4. 新增安全回归测试 `tests/unit/platform/iam/stride-framework.test.ts`：验证每个 STRIDE 维度至少有一个 mitigation 关联到代码中的具体实现

---

## §4 P1 — 明确要求但实现不足

### P1-1: §11.1 Principal 类型不完整 🟡

**设计要求**（§11.1）：6 种 Principal 类型：`user | service | agent | worker | plugin | system`

**代码现状**：`src/platform/control-plane/iam/policy-engine.ts` 中 `PrincipalType` 仅定义 3 种：`user | agent | system`。缺少 `service`、`worker`、`plugin`。

**解决方案**：

1. 扩展 `PrincipalType` 枚举，增加 `service | worker | plugin`
2. 更新 PolicyEngine 的策略评估逻辑，为新增 Principal 类型定义默认权限边界
3. 更新 `sandbox-policy.ts` 中 Principal → Sandbox 档位映射
4. 新增测试覆盖 6 种 Principal 类型的策略评估路径

---

### P1-2: §11.4 Sandbox 层级不完整 🟡

**设计要求**（§11.4）：4 档沙箱隔离级别：

| 档位                     | 能力                                   |
| ------------------------ | -------------------------------------- |
| `read_only`              | 仅读取，不可写                         |
| `workspace_write`        | 可写工作区，不可外部调用               |
| `scoped_external_access` | 受限外部调用（白名单域 + 速率限制）    |
| `restricted_exec`        | 受限执行（超时 + 资源配额 + 审计追踪） |

**代码现状**：`src/platform/control-plane/iam/sandbox-policy.ts` 定义 3 档：`read_only | workspace_write | danger_full_access`。缺少 `scoped_external_access` 和 `restricted_exec`，且 `danger_full_access` 不在设计规范中。

**解决方案**：

1. 替换 `danger_full_access` 为 `scoped_external_access` 和 `restricted_exec`
2. 在 `scoped_external_access` 档位集成 `egress-control-service.ts` 的域白名单和速率限制
3. 在 `restricted_exec` 档位增加执行超时、资源配额（CPU/内存/网络）、审计追踪强制开启
4. 将现有使用 `danger_full_access` 的代码迁移到新档位，需逐一评估每个调用点的实际需求
5. 新增测试覆盖 4 档沙箱的能力矩阵

---

### P1-3: §6.6 Cursor-based 分页不完整 🟡

**设计要求**（§6.6）：所有列表接口使用 cursor-based 分页，返回 `next_cursor` + `has_more` 字段。

**代码现状**：

- `src/platform/interface/api/http-server/channel-gateway-routes.ts` 使用了 cursor 参数 ✅
- `src/platform/interface/api/http-server/task-routes.ts` 使用简单 `limit` 截断，无 cursor ❌
- `src/platform/interface/api/http-server/workflow-routes.ts` 同上 ❌
- 其余列表路由未检查，预计多数使用简单 limit

**解决方案**：

1. 新建 `src/platform/interface/api/shared/cursor-pagination.ts`：

   ```typescript
   export interface CursorPage<T> {
     items: T[];
     next_cursor: string | null;
     has_more: boolean;
   }

   export function encodeCursor(offset: number, sort_key: string): string;
   export function decodeCursor(cursor: string): {
     offset: number;
     sort_key: string;
   };
   ```

2. 逐个迁移列表路由（task-routes、workflow-routes 等）使用 `CursorPage<T>` 返回类型
3. 保持向后兼容：同时支持 `?cursor=` 和 `?offset=&limit=` 查询参数，cursor 优先
4. 新增集成测试验证分页行为

---

### P1-4: §21.1 HITL 7 种模式覆盖度待验证 🟡

**设计要求**（§21.1）：7 种 HITL 模式：

1. 单人审批（single_approval）
2. 多方审批（multi_party_approval）
3. 委托审批（delegated_approval）
4. 迭代反馈（iterative_feedback）
5. 协同编辑（collaborative_edit）
6. 知情确认（informed_confirmation）
7. 断路人工（circuit_breaker_human）

**代码现状**：`src/platform/orchestration/hitl/` 有 6 个文件约 1,474 行。初步扫描显示大部分模式有实现，但需逐一比对确认 `delegated_approval` 和 `circuit_breaker_human` 的完整性。

**解决方案**：

1. 确认 `hitl/` 目录中每个文件对应的 HITL 模式
2. 对缺失/不完整的模式补充实现
3. 新建 `src/platform/contracts/types/hitl-modes.ts` 统一枚举 7 种模式，确保类型安全
4. 为每种模式至少有一个集成测试场景

---

### P1-5: §11.2 RBAC + Capability + Context-aware 三层授权不完整 🟡

**设计要求**（§11.2）：三层授权模型：

- **Layer 1 — RBAC**：角色定义表（platform_admin / domain_admin / developer / viewer / compliance_officer）
- **Layer 2 — Capability**：能力矩阵（每个角色对每个资源类型的 CRUD + 特殊操作权限）
- **Layer 3 — Context-aware**：上下文感知策略（基于时间/位置/风险评分/租户状态动态调整权限）

**代码现状**：

- `PolicyEngine` 有策略评估逻辑，支持 principal + action + resource 三元组
- `SandboxPolicy` 有隔离级别控制
- **无正式 RBAC 角色定义枚举**（代码中角色以字符串形式传入，无类型约束）
- **无 Capability 矩阵数据结构**（能力检查散落在各路由中间件中）
- Context-aware 层仅在风险控制模块中部分实现

**解决方案**：

1. 新建 `src/platform/control-plane/iam/rbac/role-definitions.ts`：

   ```typescript
   export enum PlatformRole {
     PLATFORM_ADMIN = "platform_admin",
     DOMAIN_ADMIN = "domain_admin",
     DEVELOPER = "developer",
     VIEWER = "viewer",
     COMPLIANCE_OFFICER = "compliance_officer",
   }
   ```

2. 新建 `src/platform/control-plane/iam/rbac/capability-matrix.ts`：定义角色 × 资源 × 操作的能力矩阵
3. 在 `PolicyEngine` 中集成三层评估链：RBAC → Capability → Context-aware
4. 将现有散落的角色字符串检查迁移到统一的 RBAC 层

---

### P1-6: §71-§94 垂直域专属架构缺失 🟡

**设计要求**（§71-§94）：24 个垂直域每个定义专属架构章节，包含域特定的工具链、数据模型、风控规则、KPI 定义。

**代码现状**：

- `src/domains/` 仅 `coding/` 有专用子目录（1 文件 31 行 `coding-domain-tools.ts`）
- 其余 23 个域依赖 `DomainBaselineCatalog`（`src/domains/registry/domain-baseline-catalog.ts` 1,113 行）的通用目录模式
- `DomainBaselineCatalog` 为 24 域提供了配置化的工具列表、风控参数、KPI 定义，但**无域特定的业务逻辑代码**

**解决方案**：

1. 此差距属于**设计前瞻性 vs 实现阶段性**的自然差距
2. 短期方案：确认 `DomainBaselineCatalog` 的通用目录模式足以支撑当前阶段需求，为未来域专属模块预留目录结构
3. 中期方案：优先为高价值域（电商、客服、财务）创建专属子目录，提取域特定逻辑
4. 在 `src/domains/README.md` 文档化域模块扩展规范

---

### P1-7: §68 多模态能力视频处理为骨架 🟡

**设计要求**（§68）：多模态能力包含图像/音频/视频处理管线，需支持实时转写、内容分析、元数据提取。

**代码现状**：

- `src/ops-maturity/multimodal/` 有 7 文件 381 行
- 图像处理：有基本实现 ✅
- 音频处理：有转写管线 ✅
- 视频处理：仅元数据提取 + 模拟转写（骨架代码），**无实际视频帧分析或实时转写** 🟡

**解决方案**：

1. 完善 `src/ops-maturity/multimodal/video/` 中的视频处理管线
2. 集成 FFmpeg（或等效工具）进行视频帧提取和音轨分离
3. 复用已有音频转写管线处理视频音轨
4. 视频帧分析可延后至 v2 阶段，当前优先完成音轨转写

---

## §5 P2 — 细节补全

### P2-1: §6.7 Webhook + Outbox 耦合缺失 🟡

**设计要求**（§6.7）：Webhook 投递使用 outbox pattern 保证 at-least-once 语义。

**代码现状**：

- `src/platform/shared/outbox/`（6 文件 1,045 行）：完整的 outbox 实现
- `src/platform/interface/api/http-server/webhook-routes.ts`：独立的 webhook 路由
- 两者**独立实现，未耦合**：webhook 直接发送 HTTP 请求，未通过 outbox 表持久化

**解决方案**：

1. 在 webhook 投递流程中引入 outbox：webhook 事件先写入 outbox 表，由 outbox processor 异步投递
2. 增加投递重试和幂等性保证（outbox 已有该能力，只需集成）
3. 在 webhook-routes 中增加投递状态查询端点

---

### P2-2: §26.3 逻辑表数量差异 🟡

**设计要求**（§26.3）：71 张逻辑表，分为 7 组。

**代码现状**：实际 55 张 SQLite 表 + PostgreSQL 迁移脚本。差距约 16 张表。

**解决方案**：

1. 导出当前所有表名列表，与设计文档 71 张表逐一对账
2. 确认缺失的 16 张表是否为尚未实现的功能模块（如垂直域专属表）
3. 对已实现但表名不同的情况建立映射关系
4. 在 `docs_zh/contracts/` 中维护实际表 vs 设计表的对照文档

---

### P2-3: §37.11 统一领域元模型 12 问覆盖度 🟡

**设计要求**（§37.11）：统一领域元模型定义 12 个标准问题，每个业务域必须回答。

**代码现状**：

- `src/domains/canonical-meta-model/`（4 文件 140 行）：有 Validator、Seeder、CompletenessCalculator
- 需确认 12 个标准问题是否全部在 Validator 中实现

**解决方案**：

1. 逐一比对 `canonical-meta-model/validator.ts` 中的验证规则与设计文档 12 问
2. 补充缺失的验证规则
3. 在 CompletenessCalculator 中确保 12 问全部纳入完整度计算

---

## §6 已对齐章节汇总

以下设计章节在代码中已有完整实现，无差距：

| 设计章节 | 要求摘要                             | 代码位置                                                        |
| -------- | ------------------------------------ | --------------------------------------------------------------- |
| §5       | 平面间通信契约（7 个类型）           | `src/platform/contracts/types/platform-contracts.ts`（321 行）  |
| §6.1-6.5 | API 分层/版本化/认证                 | `src/platform/interface/api/http-server/`（17 文件 2,752 行）   |
| §7       | 服务通信（outbox + circuit breaker） | `src/platform/shared/outbox/` + `circuit-breaker/`              |
| §9       | 稳定性架构（7 层）                   | `src/platform/control-plane/stability/`                         |
| §10      | 风险控制（加权评分引擎）             | `src/platform/control-plane/risk-control/`（4 文件 493 行）     |
| §11.3    | Secret 管理（4 提供商）              | `src/platform/control-plane/iam/secret-management/`             |
| §11.5    | Egress 控制                          | `src/platform/control-plane/iam/egress-control/`（~870 行）     |
| §13      | OAPEFLIR（8 阶段）                   | `src/platform/orchestration/oapeflir/`（64 文件 5,678 行）      |
| §14      | Runtime Execution                    | `src/platform/runtime/`（dispatcher/worker-pool/tool-executor） |
| §15      | Model Gateway                        | `src/platform/ai-operations/model-gateway/`                     |
| §16      | Prompt Engine                        | `src/platform/ai-operations/prompt-engine/`                     |
| §17      | Quality Gate                         | `src/platform/ai-operations/quality-gate/`                      |
| §18      | Cost Alert                           | `src/platform/ai-operations/cost-alert/`                        |
| §19      | Delegation                           | `src/platform/orchestration/delegation/`                        |
| §20      | Workflow Sleep                       | `src/platform/orchestration/workflow-sleep/`                    |
| §22      | SDK                                  | `src/sdk/`                                                      |
| §23      | 合规引擎                             | `src/org-governance/compliance-engine/`                         |
| §24      | 配置管理                             | `config/`（60 文件）                                            |
| §25      | 存储层（CQRS + Projection）          | `src/platform/state-evidence/`                                  |
| §27      | SLO 引擎                             | `src/platform/state-evidence/slo/`                              |
| §28      | Event Sourcing                       | `src/platform/state-evidence/events/`                           |
| §29      | Knowledge Base                       | `src/platform/ai-operations/knowledge/`                         |
| §30      | Business Pack                        | `src/scale-ecosystem/marketplace/`                              |
| §31      | HA（高可用）                         | `src/platform/runtime/recovery/`                                |
| §32      | 部署架构                             | `deploy/`（42 文件）                                            |
| §37-§38  | 业务域建模                           | `src/domains/registry/domain-baseline-catalog.ts`（1,113 行）   |
| §39      | NL Gateway                           | `src/interaction/nl-gateway/`                                   |
| §40      | Goal Decomposer                      | `src/interaction/goal-decomposer/`                              |
| §41      | Proactive Agent                      | `src/interaction/proactive-agent/`                              |
| §42      | Autonomy Level                       | `src/interaction/autonomy/`                                     |
| §43      | Dashboard（4 层看板）                | `src/interaction/dashboard/`                                    |
| §44      | UX Flows                             | `src/interaction/ux/`                                           |
| §45      | Harness Runtime                      | `src/platform/orchestration/harness/`（29 文件 1,471 行）       |
| §46-§51  | 组织治理层                           | `src/org-governance/`                                           |
| §52-§57  | 规模化运行层                         | `src/scale-ecosystem/`                                          |
| §59      | 可解释性                             | `src/ops-maturity/explainability/`                              |
| §60      | 紧急制动                             | `src/ops-maturity/panic/`                                       |
| §61      | Agent 生命周期                       | `src/ops-maturity/agent-lifecycle/`                             |
| §62      | 漂移检测                             | `src/ops-maturity/drift-detection/`                             |
| §63      | 调试器                               | `src/ops-maturity/debugger/`                                    |
| §64      | 成本优化                             | `src/ops-maturity/cost-optimization/`                           |
| §65      | 工作流调试器                         | `src/ops-maturity/workflow-debugger/`                           |

---

## §7 结论

### 差距统计

| 级别 | 数量 | 典型问题                                         |
| ---- | ---- | ------------------------------------------------ |
| P0   | 3    | E1-E6 分类缺失、SEV1-4 统一等级缺失、STRIDE 缺失 |
| P1   | 7    | Principal/Sandbox/分页/HITL/RBAC/垂直域/多模态   |
| P2   | 3    | Webhook-Outbox 耦合、逻辑表对账、元模型 12 问    |

### 修复优先级建议

1. **第一批（P0，1-2 周）**：P0-1 异常事件分类 → P0-2 统一严重度 → P0-3 STRIDE 框架。这三项是设计契约级违规，影响跨模块一致性
2. **第二批（P1 高优，2-3 周）**：P1-1 Principal → P1-2 Sandbox → P1-5 RBAC 三层授权。IAM 相关差距应一起修复
3. **第三批（P1 中优，3-4 周）**：P1-3 分页 → P1-4 HITL → P1-7 多模态。功能完整性补全
4. **第四批（P1 低优 + P2，持续）**：P1-6 垂直域 → P2-1/P2-2/P2-3。阶段性差距和细节补全

### 整体评估

代码库对设计文档的对齐度约为 **85-90%**（40+ 章节完全对齐，13 项差距中仅 3 项为 P0 级）。核心运行时架构（OAPEFLIR 8 阶段、5 平面通信契约、风险控制引擎、稳定性 7 层）已完整实现。主要差距集中在安全分类框架（STRIDE/SEV/异常分类）和 IAM 精细化层级，属于"骨架完整但精细度不足"的阶段性差距。
# 平台架构设计 vs 代码实现 — 全量差距评审

> **版本**: v8.0
> **评审日期**: 2026-04-23
> **设计基线**: `docs_zh/architecture/00-platform-architecture.md` v3.2（§1-§94，约 8,000 行）
> **评审对象**: `src/` 全代码库（1,387 文件 265,020 行）
> **评审范围**: 设计文档全部章节 §1-§94 vs 代码实现完整性
> **前版说明**: v7.0 仅覆盖 UI 架构(Doc-12) vs 设计文档差距，本版升级为全代码库 vs 设计文档差距评审

---

## §1 评审方法论

### 1.1 扫描范围

| 维度       | 覆盖内容                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 设计侧     | 00-arch §5-§14（平台基础设施）、§15-§32（AI 运营层）、§37-§69（业务域/交互/治理/规模化/运营成熟度层）                                               |
| 代码侧     | `src/platform/`、`src/domains/`、`src/interaction/`、`src/org-governance/`、`src/scale-ecosystem/`、`src/ops-maturity/`、`src/sdk/`、`src/plugins/` |
| 配置与部署 | `config/`（60 文件）、`deploy/`（42 文件）                                                                                                          |
| 测试       | `tests/`（1,825 文件 440,180 行）                                                                                                                   |

### 1.2 判定标准

| 符号 | 含义     | 判定标准                                           |
| ---- | -------- | -------------------------------------------------- |
| ❌   | 完全缺失 | 设计有明确定义，代码中无对应枚举/类/模块/接口      |
| 🟡   | 部分实现 | 有相关代码但覆盖度不足（缺少子类型/子模式/子阶段） |
| ✅   | 已对齐   | 设计要求在代码中有完整实现（类型+逻辑+测试）       |

### 1.3 优先级定义

| 级别 | 定义                                           | 影响                       |
| ---- | ---------------------------------------------- | -------------------------- |
| P0   | 设计核心要求完全缺失，架构违规                 | 运行时行为与设计契约不一致 |
| P1   | 设计明确要求但实现不足（缺少子类型/枚举/模式） | 功能不完整，存在隐性风险   |
| P2   | 细节补全，不影响核心功能                       | 改善一致性和可维护性       |

---

## §2 差距总览

| 分类                     | 数量 | 说明                                  |
| ------------------------ | ---- | ------------------------------------- |
| P0（架构违规）           | 3    | 设计核心分类/等级体系在代码中完全缺失 |
| P1（明确要求但实现不足） | 7    | 设计有明确规范但代码覆盖度不足        |
| P2（细节补全）           | 3    | 次要对齐项，不影响核心功能            |
| ✅ 已对齐                | 40+  | 设计要求在代码中已完整实现            |

---

## §3 P0 — 架构违规

### P0-1: §12.1 异常事件分类体系 E1-E6 完全缺失 ❌

**设计要求**（§12.1）：

平台定义 6 类异常事件分类：

| 分类 | 名称     | 定义                       |
| ---- | -------- | -------------------------- |
| E1   | 业务异常 | 业务规则/SLA/KPI 偏离      |
| E2   | 执行异常 | Agent/Workflow 执行失败    |
| E3   | 外部依赖 | 第三方 API/服务不可用      |
| E4   | 安全异常 | 未授权访问/数据泄露/注入   |
| E5   | 数据异常 | 数据质量/一致性/完整性问题 |
| E6   | 治理异常 | 合规/审批/策略违反         |

**代码现状**：

- `src/platform/shared/observability/anomaly-detection-service.ts`（795 行）使用 `AnomalyCategory` 枚举：`spike | trend_change | level_shift`
- 这是统计检测方法分类，**不是**设计要求的业务异常事件分类
- 代码中无任何文件定义 E1-E6 枚举或等价分类
- `src/platform/state-evidence/events/` 26 个文件中均未引用 E1-E6 分类

**解决方案**：

1. 新建 `src/platform/contracts/types/anomaly-event-classification.ts`：

   ```typescript
   export enum AnomalyEventClass {
     E1_BUSINESS = "E1_BUSINESS",
     E2_EXECUTION = "E2_EXECUTION",
     E3_EXTERNAL_DEPENDENCY = "E3_EXTERNAL_DEPENDENCY",
     E4_SECURITY = "E4_SECURITY",
     E5_DATA = "E5_DATA",
     E6_GOVERNANCE = "E6_GOVERNANCE",
   }

   export interface ClassifiedAnomalyEvent {
     event_id: string;
     class: AnomalyEventClass;
     severity: UnifiedSeverity; // 见 P0-2
     source_plane: PlaneId;
     detected_at: string;
     details: Record<string, unknown>;
   }
   ```

2. 在 `anomaly-detection-service.ts` 中增加分类映射层：统计检测结果（spike/trend_change/level_shift）→ 业务分类（E1-E6），基于事件来源平面和上下文自动映射

3. 在 `src/platform/state-evidence/events/` 中更新事件发布接口，所有异常事件必须携带 `AnomalyEventClass` 字段

4. 新增测试 `tests/unit/platform/anomaly-event-classification.test.ts` 覆盖 6 类分类映射

---

### P0-2: §12.2 统一严重度等级 SEV1-SEV4 缺失 ❌

**设计要求**（§12.2）：

平台统一使用 4 级严重度：

| 等级 | 名称     | 响应时间 | 影响范围          |
| ---- | -------- | -------- | ----------------- |
| SEV1 | Critical | ≤5min    | 全平台/多租户中断 |
| SEV2 | Major    | ≤15min   | 单租户/单域中断   |
| SEV3 | Minor    | ≤1h      | 单功能降级        |
| SEV4 | Low      | ≤4h      | 非功能性/优化建议 |

**代码现状**：

代码中存在 **3 套互不兼容的严重度体系**：

| 模块                | 文件路径                                            | 枚举值                             |
| ------------------- | --------------------------------------------------- | ---------------------------------- |
| Incident Management | `src/platform/shared/observability/incident-*.ts`   | `P0 \| P1 \| P2 \| P3`             |
| Anomaly Detection   | `src/platform/shared/observability/anomaly-*.ts`    | `warning \| critical \| emergency` |
| SLO Alerting        | `src/platform/state-evidence/slo/alert-severity.ts` | `AlertSeverity` 自定义枚举         |

**解决方案**：

1. 新建 `src/platform/contracts/types/unified-severity.ts`：

   ```typescript
   export enum UnifiedSeverity {
     SEV1 = "SEV1",
     SEV2 = "SEV2",
     SEV3 = "SEV3",
     SEV4 = "SEV4",
   }

   export const SEVERITY_SLA: Record<
     UnifiedSeverity,
     { response_minutes: number; resolution_minutes: number }
   > = {
     SEV1: { response_minutes: 5, resolution_minutes: 30 },
     SEV2: { response_minutes: 15, resolution_minutes: 120 },
     SEV3: { response_minutes: 60, resolution_minutes: 480 },
     SEV4: { response_minutes: 240, resolution_minutes: 2880 },
   };
   ```

2. 为每个现有模块增加映射函数（保持向后兼容）：

   ```typescript
   // incident-severity-mapper.ts
   export function toUnifiedSeverity(
     priority: "P0" | "P1" | "P2" | "P3",
   ): UnifiedSeverity {
     const map = {
       P0: UnifiedSeverity.SEV1,
       P1: UnifiedSeverity.SEV2,
       P2: UnifiedSeverity.SEV3,
       P3: UnifiedSeverity.SEV4,
     };
     return map[priority];
   }
   ```

3. 所有跨模块事件（outbox 消息、WS 推送、审计日志）统一使用 `UnifiedSeverity`

4. 新增集成测试验证三套体系到 SEV1-4 的映射一致性

---

### P0-3: §11.8 STRIDE 威胁模型完全缺失 ❌

**设计要求**（§11.8）：

平台安全架构基于 STRIDE 六维度威胁评估：

| 维度                   | 缩写 | 设计要求的防御措施          |
| ---------------------- | ---- | --------------------------- |
| Spoofing               | S    | mTLS + JWT + Principal 验证 |
| Tampering              | T    | HMAC 签名 + 审计哈希链      |
| Repudiation            | R    | 不可否认审计日志 + 时间戳   |
| Information Disclosure | I    | Egress 控制 + Secret 加密   |
| Denial of Service      | D    | 限流 + 熔断 + 弹性伸缩      |
| Elevation of Privilege | E    | RBAC + Sandbox + Capability |

并要求维护补充威胁矩阵（threat matrix），每次安全变更需更新。

**代码现状**：

- `src/platform/control-plane/iam/` 21 文件 7,386 行：有 PolicyEngine、SandboxPolicy、EgressControl，但**无 STRIDE 枚举或威胁矩阵数据结构**
- 唯一出现 "tampering" 的位置是 `audit-integrity-checker.ts` 中的注释
- 无 `ThreatModel`、`ThreatCategory`、`ThreatAssessment` 等类型定义
- 各安全防御措施（mTLS/JWT/HMAC/限流/熔断/Sandbox）已独立实现，但未关联到统一的 STRIDE 框架

**解决方案**：

1. 新建 `src/platform/control-plane/iam/threat-model/stride-framework.ts`：

   ```typescript
   export enum StrideCategory {
     SPOOFING = "SPOOFING",
     TAMPERING = "TAMPERING",
     REPUDIATION = "REPUDIATION",
     INFORMATION_DISCLOSURE = "INFORMATION_DISCLOSURE",
     DENIAL_OF_SERVICE = "DENIAL_OF_SERVICE",
     ELEVATION_OF_PRIVILEGE = "ELEVATION_OF_PRIVILEGE",
   }

   export interface ThreatEntry {
     id: string;
     category: StrideCategory;
     asset: string;
     threat_description: string;
     mitigations: string[];
     residual_risk: "low" | "medium" | "high";
     last_reviewed: string;
   }

   export interface ThreatMatrix {
     version: string;
     entries: ThreatEntry[];
     reviewed_by: string;
     reviewed_at: string;
   }
   ```

2. 新建 `src/platform/control-plane/iam/threat-model/threat-matrix-registry.ts`：维护威胁矩阵注册表，关联现有安全组件（PolicyEngine → E，EgressControl → I，AuditIntegrityChecker → T/R，CircuitBreaker → D）

3. 新建 `config/security/threat-matrix.json`：初始威胁矩阵数据，覆盖 6 个 STRIDE 维度 × 核心资产

4. 新增安全回归测试 `tests/unit/platform/iam/stride-framework.test.ts`：验证每个 STRIDE 维度至少有一个 mitigation 关联到代码中的具体实现

---

## §4 P1 — 明确要求但实现不足

### P1-1: §11.1 Principal 类型不完整 🟡

**设计要求**（§11.1）：6 种 Principal 类型：`user | service | agent | worker | plugin | system`

**代码现状**：`src/platform/control-plane/iam/policy-engine.ts` 中 `PrincipalType` 仅定义 3 种：`user | agent | system`。缺少 `service`、`worker`、`plugin`。

**解决方案**：

1. 扩展 `PrincipalType` 枚举，增加 `service | worker | plugin`
2. 更新 PolicyEngine 的策略评估逻辑，为新增 Principal 类型定义默认权限边界
3. 更新 `sandbox-policy.ts` 中 Principal → Sandbox 档位映射
4. 新增测试覆盖 6 种 Principal 类型的策略评估路径

---

### P1-2: §11.4 Sandbox 层级不完整 🟡

**设计要求**（§11.4）：4 档沙箱隔离级别：

| 档位                     | 能力                                   |
| ------------------------ | -------------------------------------- |
| `read_only`              | 仅读取，不可写                         |
| `workspace_write`        | 可写工作区，不可外部调用               |
| `scoped_external_access` | 受限外部调用（白名单域 + 速率限制）    |
| `restricted_exec`        | 受限执行（超时 + 资源配额 + 审计追踪） |

**代码现状**：`src/platform/control-plane/iam/sandbox-policy.ts` 定义 3 档：`read_only | workspace_write | danger_full_access`。缺少 `scoped_external_access` 和 `restricted_exec`，且 `danger_full_access` 不在设计规范中。

**解决方案**：

1. 替换 `danger_full_access` 为 `scoped_external_access` 和 `restricted_exec`
2. 在 `scoped_external_access` 档位集成 `egress-control-service.ts` 的域白名单和速率限制
3. 在 `restricted_exec` 档位增加执行超时、资源配额（CPU/内存/网络）、审计追踪强制开启
4. 将现有使用 `danger_full_access` 的代码迁移到新档位，需逐一评估每个调用点的实际需求
5. 新增测试覆盖 4 档沙箱的能力矩阵

---

### P1-3: §6.6 Cursor-based 分页不完整 🟡

**设计要求**（§6.6）：所有列表接口使用 cursor-based 分页，返回 `next_cursor` + `has_more` 字段。

**代码现状**：

- `src/platform/interface/api/http-server/channel-gateway-routes.ts` 使用了 cursor 参数 ✅
- `src/platform/interface/api/http-server/task-routes.ts` 使用简单 `limit` 截断，无 cursor ❌
- `src/platform/interface/api/http-server/workflow-routes.ts` 同上 ❌
- 其余列表路由未检查，预计多数使用简单 limit

**解决方案**：

1. 新建 `src/platform/interface/api/shared/cursor-pagination.ts`：

   ```typescript
   export interface CursorPage<T> {
     items: T[];
     next_cursor: string | null;
     has_more: boolean;
   }

   export function encodeCursor(offset: number, sort_key: string): string;
   export function decodeCursor(cursor: string): {
     offset: number;
     sort_key: string;
   };
   ```

2. 逐个迁移列表路由（task-routes、workflow-routes 等）使用 `CursorPage<T>` 返回类型
3. 保持向后兼容：同时支持 `?cursor=` 和 `?offset=&limit=` 查询参数，cursor 优先
4. 新增集成测试验证分页行为

---

### P1-4: §21.1 HITL 7 种模式覆盖度待验证 🟡

**设计要求**（§21.1）：7 种 HITL 模式：

1. 单人审批（single_approval）
2. 多方审批（multi_party_approval）
3. 委托审批（delegated_approval）
4. 迭代反馈（iterative_feedback）
5. 协同编辑（collaborative_edit）
6. 知情确认（informed_confirmation）
7. 断路人工（circuit_breaker_human）

**代码现状**：`src/platform/orchestration/hitl/` 有 6 个文件约 1,474 行。初步扫描显示大部分模式有实现，但需逐一比对确认 `delegated_approval` 和 `circuit_breaker_human` 的完整性。

**解决方案**：

1. 确认 `hitl/` 目录中每个文件对应的 HITL 模式
2. 对缺失/不完整的模式补充实现
3. 新建 `src/platform/contracts/types/hitl-modes.ts` 统一枚举 7 种模式，确保类型安全
4. 为每种模式至少有一个集成测试场景

---

### P1-5: §11.2 RBAC + Capability + Context-aware 三层授权不完整 🟡

**设计要求**（§11.2）：三层授权模型：

- **Layer 1 — RBAC**：角色定义表（platform_admin / domain_admin / developer / viewer / compliance_officer）
- **Layer 2 — Capability**：能力矩阵（每个角色对每个资源类型的 CRUD + 特殊操作权限）
- **Layer 3 — Context-aware**：上下文感知策略（基于时间/位置/风险评分/租户状态动态调整权限）

**代码现状**：

- `PolicyEngine` 有策略评估逻辑，支持 principal + action + resource 三元组
- `SandboxPolicy` 有隔离级别控制
- **无正式 RBAC 角色定义枚举**（代码中角色以字符串形式传入，无类型约束）
- **无 Capability 矩阵数据结构**（能力检查散落在各路由中间件中）
- Context-aware 层仅在风险控制模块中部分实现

**解决方案**：

1. 新建 `src/platform/control-plane/iam/rbac/role-definitions.ts`：

   ```typescript
   export enum PlatformRole {
     PLATFORM_ADMIN = "platform_admin",
     DOMAIN_ADMIN = "domain_admin",
     DEVELOPER = "developer",
     VIEWER = "viewer",
     COMPLIANCE_OFFICER = "compliance_officer",
   }
   ```

2. 新建 `src/platform/control-plane/iam/rbac/capability-matrix.ts`：定义角色 × 资源 × 操作的能力矩阵
3. 在 `PolicyEngine` 中集成三层评估链：RBAC → Capability → Context-aware
4. 将现有散落的角色字符串检查迁移到统一的 RBAC 层

---

### P1-6: §71-§94 垂直域专属架构缺失 🟡

**设计要求**（§71-§94）：24 个垂直域每个定义专属架构章节，包含域特定的工具链、数据模型、风控规则、KPI 定义。

**代码现状**：

- `src/domains/` 仅 `coding/` 有专用子目录（1 文件 31 行 `coding-domain-tools.ts`）
- 其余 23 个域依赖 `DomainBaselineCatalog`（`src/domains/registry/domain-baseline-catalog.ts` 1,113 行）的通用目录模式
- `DomainBaselineCatalog` 为 24 域提供了配置化的工具列表、风控参数、KPI 定义，但**无域特定的业务逻辑代码**

**解决方案**：

1. 此差距属于**设计前瞻性 vs 实现阶段性**的自然差距
2. 短期方案：确认 `DomainBaselineCatalog` 的通用目录模式足以支撑当前阶段需求，为未来域专属模块预留目录结构
3. 中期方案：优先为高价值域（电商、客服、财务）创建专属子目录，提取域特定逻辑
4. 在 `src/domains/README.md` 文档化域模块扩展规范

---

### P1-7: §68 多模态能力视频处理为骨架 🟡

**设计要求**（§68）：多模态能力包含图像/音频/视频处理管线，需支持实时转写、内容分析、元数据提取。

**代码现状**：

- `src/ops-maturity/multimodal/` 有 7 文件 381 行
- 图像处理：有基本实现 ✅
- 音频处理：有转写管线 ✅
- 视频处理：仅元数据提取 + 模拟转写（骨架代码），**无实际视频帧分析或实时转写** 🟡

**解决方案**：

1. 完善 `src/ops-maturity/multimodal/video/` 中的视频处理管线
2. 集成 FFmpeg（或等效工具）进行视频帧提取和音轨分离
3. 复用已有音频转写管线处理视频音轨
4. 视频帧分析可延后至 v2 阶段，当前优先完成音轨转写

---

## §5 P2 — 细节补全

### P2-1: §6.7 Webhook + Outbox 耦合缺失 🟡

**设计要求**（§6.7）：Webhook 投递使用 outbox pattern 保证 at-least-once 语义。

**代码现状**：

- `src/platform/shared/outbox/`（6 文件 1,045 行）：完整的 outbox 实现
- `src/platform/interface/api/http-server/webhook-routes.ts`：独立的 webhook 路由
- 两者**独立实现，未耦合**：webhook 直接发送 HTTP 请求，未通过 outbox 表持久化

**解决方案**：

1. 在 webhook 投递流程中引入 outbox：webhook 事件先写入 outbox 表，由 outbox processor 异步投递
2. 增加投递重试和幂等性保证（outbox 已有该能力，只需集成）
3. 在 webhook-routes 中增加投递状态查询端点

---

### P2-2: §26.3 逻辑表数量差异 🟡

**设计要求**（§26.3）：71 张逻辑表，分为 7 组。

**代码现状**：实际 55 张 SQLite 表 + PostgreSQL 迁移脚本。差距约 16 张表。

**解决方案**：

1. 导出当前所有表名列表，与设计文档 71 张表逐一对账
2. 确认缺失的 16 张表是否为尚未实现的功能模块（如垂直域专属表）
3. 对已实现但表名不同的情况建立映射关系
4. 在 `docs_zh/contracts/` 中维护实际表 vs 设计表的对照文档

---

### P2-3: §37.11 统一领域元模型 12 问覆盖度 🟡

**设计要求**（§37.11）：统一领域元模型定义 12 个标准问题，每个业务域必须回答。

**代码现状**：

- `src/domains/canonical-meta-model/`（4 文件 140 行）：有 Validator、Seeder、CompletenessCalculator
- 需确认 12 个标准问题是否全部在 Validator 中实现

**解决方案**：

1. 逐一比对 `canonical-meta-model/validator.ts` 中的验证规则与设计文档 12 问
2. 补充缺失的验证规则
3. 在 CompletenessCalculator 中确保 12 问全部纳入完整度计算

---

## §6 已对齐章节汇总

以下设计章节在代码中已有完整实现，无差距：

| 设计章节 | 要求摘要                             | 代码位置                                                        |
| -------- | ------------------------------------ | --------------------------------------------------------------- |
| §5       | 平面间通信契约（7 个类型）           | `src/platform/contracts/types/platform-contracts.ts`（321 行）  |
| §6.1-6.5 | API 分层/版本化/认证                 | `src/platform/interface/api/http-server/`（17 文件 2,752 行）   |
| §7       | 服务通信（outbox + circuit breaker） | `src/platform/shared/outbox/` + `circuit-breaker/`              |
| §9       | 稳定性架构（7 层）                   | `src/platform/control-plane/stability/`                         |
| §10      | 风险控制（加权评分引擎）             | `src/platform/control-plane/risk-control/`（4 文件 493 行）     |
| §11.3    | Secret 管理（4 提供商）              | `src/platform/control-plane/iam/secret-management/`             |
| §11.5    | Egress 控制                          | `src/platform/control-plane/iam/egress-control/`（~870 行）     |
| §13      | OAPEFLIR（8 阶段）                   | `src/platform/orchestration/oapeflir/`（64 文件 5,678 行）      |
| §14      | Runtime Execution                    | `src/platform/runtime/`（dispatcher/worker-pool/tool-executor） |
| §15      | Model Gateway                        | `src/platform/ai-operations/model-gateway/`                     |
| §16      | Prompt Engine                        | `src/platform/ai-operations/prompt-engine/`                     |
| §17      | Quality Gate                         | `src/platform/ai-operations/quality-gate/`                      |
| §18      | Cost Alert                           | `src/platform/ai-operations/cost-alert/`                        |
| §19      | Delegation                           | `src/platform/orchestration/delegation/`                        |
| §20      | Workflow Sleep                       | `src/platform/orchestration/workflow-sleep/`                    |
| §22      | SDK                                  | `src/sdk/`                                                      |
| §23      | 合规引擎                             | `src/org-governance/compliance-engine/`                         |
| §24      | 配置管理                             | `config/`（60 文件）                                            |
| §25      | 存储层（CQRS + Projection）          | `src/platform/state-evidence/`                                  |
| §27      | SLO 引擎                             | `src/platform/state-evidence/slo/`                              |
| §28      | Event Sourcing                       | `src/platform/state-evidence/events/`                           |
| §29      | Knowledge Base                       | `src/platform/ai-operations/knowledge/`                         |
| §30      | Business Pack                        | `src/scale-ecosystem/marketplace/`                              |
| §31      | HA（高可用）                         | `src/platform/runtime/recovery/`                                |
| §32      | 部署架构                             | `deploy/`（42 文件）                                            |
| §37-§38  | 业务域建模                           | `src/domains/registry/domain-baseline-catalog.ts`（1,113 行）   |
| §39      | NL Gateway                           | `src/interaction/nl-gateway/`                                   |
| §40      | Goal Decomposer                      | `src/interaction/goal-decomposer/`                              |
| §41      | Proactive Agent                      | `src/interaction/proactive-agent/`                              |
| §42      | Autonomy Level                       | `src/interaction/autonomy/`                                     |
| §43      | Dashboard（4 层看板）                | `src/interaction/dashboard/`                                    |
| §44      | UX Flows                             | `src/interaction/ux/`                                           |
| §45      | Harness Runtime                      | `src/platform/orchestration/harness/`（29 文件 1,471 行）       |
| §46-§51  | 组织治理层                           | `src/org-governance/`                                           |
| §52-§57  | 规模化运行层                         | `src/scale-ecosystem/`                                          |
| §59      | 可解释性                             | `src/ops-maturity/explainability/`                              |
| §60      | 紧急制动                             | `src/ops-maturity/panic/`                                       |
| §61      | Agent 生命周期                       | `src/ops-maturity/agent-lifecycle/`                             |
| §62      | 漂移检测                             | `src/ops-maturity/drift-detection/`                             |
| §63      | 调试器                               | `src/ops-maturity/debugger/`                                    |
| §64      | 成本优化                             | `src/ops-maturity/cost-optimization/`                           |
| §65      | 工作流调试器                         | `src/ops-maturity/workflow-debugger/`                           |

---

## §7 结论

### 差距统计

| 级别 | 数量 | 典型问题                                         |
| ---- | ---- | ------------------------------------------------ |
| P0   | 3    | E1-E6 分类缺失、SEV1-4 统一等级缺失、STRIDE 缺失 |
| P1   | 7    | Principal/Sandbox/分页/HITL/RBAC/垂直域/多模态   |
| P2   | 3    | Webhook-Outbox 耦合、逻辑表对账、元模型 12 问    |

### 修复优先级建议

1. **第一批（P0，1-2 周）**：P0-1 异常事件分类 → P0-2 统一严重度 → P0-3 STRIDE 框架。这三项是设计契约级违规，影响跨模块一致性
2. **第二批（P1 高优，2-3 周）**：P1-1 Principal → P1-2 Sandbox → P1-5 RBAC 三层授权。IAM 相关差距应一起修复
3. **第三批（P1 中优，3-4 周）**：P1-3 分页 → P1-4 HITL → P1-7 多模态。功能完整性补全
4. **第四批（P1 低优 + P2，持续）**：P1-6 垂直域 → P2-1/P2-2/P2-3。阶段性差距和细节补全

### 整体评估

代码库对设计文档的对齐度约为 **85-90%**（40+ 章节完全对齐，13 项差距中仅 3 项为 P0 级）。核心运行时架构（OAPEFLIR 8 阶段、5 平面通信契约、风险控制引擎、稳定性 7 层）已完整实现。主要差距集中在安全分类框架（STRIDE/SEV/异常分类）和 IAM 精细化层级，属于"骨架完整但精细度不足"的阶段性差距。
