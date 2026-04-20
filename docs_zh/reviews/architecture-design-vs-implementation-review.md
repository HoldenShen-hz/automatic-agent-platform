# 架构设计 vs 实现状态复核与收口报告

> **版本**: v2.1  
> **复核日期**: 2026-04-20  
> **审查对象**: `docs_zh/architecture/00-platform-architecture.md` v2.7  
> **复核策略**: 以当前 `src/`、`tests/`、`docs_zh/contracts/`、`docs_zh/adr/` 实际内容为准，修正 v2.0 报告中已经过时的“缺失/待实现”判断。

---

## 1. 结论

v2.0 报告中的大量“未实现”或“待修复”结论在本次复核时已不再成立。当前代码库已经具备：

- `platform/` 五平面核心实现与大规模测试镜像
- `domains / interaction / org-governance / scale-ecosystem / ops-maturity` 五层扩展能力
- `081-090` ADR 与对应 v2.7 capability contracts
- 多数 review 条目所指向的实际模块、服务与测试

本轮真正仍需落地的缺口，已经收敛为少量实现补强与文档一致性修正，并已在本次交付中完成。

---

## 2. 复核后确认已存在的能力

下列 review 条目在当前仓库中已存在实现，不再作为“待开发”处理：

| 能力域 | 已验证实现 |
| --- | --- |
| §8 自动扩缩容 / 队列分区 | `src/platform/shared/scaling/horizontal-scaling-controller.ts`、`src/platform/execution/queue/queue-partitioner.ts` |
| §10 风控引擎 | `src/platform/control-plane/risk-control/risk-evaluation-engine.ts`、`risk-config-loader.ts` |
| §17 质量门 / 证据 | `src/platform/prompt-engine/eval/post-execution-quality-gate.ts`、`quality-gate-evidence-service.ts` |
| §27 SLO | `src/platform/shared/observability/slo-alerting-service.ts` |
| §39 NL 入口澄清 | `src/interaction/nl-gateway/disambiguation-handler/`、`nl-gateway-config-loader.ts` |
| §42 渐进自主权 | `src/interaction/autonomy/` |
| §43 Dashboard WebSocket | `src/interaction/dashboard/dashboard-websocket-server.ts` |
| §44-§45 UX / 会话持久化 | `src/interaction/ux/` 下 conversation/template/tracking 相关服务 |
| §48 / §58 SAML + SCIM | `src/org-governance/sso-scim/saml/`、`scim-sync/` |
| §50 审计完整性 / 导出 | `src/platform/control-plane/iam/audit-event-integrity.ts`、`audit-integrity-repository.ts`、`audit-export-service.ts` |
| §52-§59 多 Region / GraphQL / gRPC 等 | `src/scale-ecosystem/multi-region/` 与 `src/platform/interface/api/graphql-adapter-service.ts` |
| §55 Pack 安全 / 依赖冲突 | `src/scale-ecosystem/marketplace/pack-security-service.ts` |
| §56 反馈导出 / 评分 | `fine-tuning-exporter.ts`、`quality-grader.ts` |
| §57 版本治理 / 兼容矩阵 | `src/ops-maturity/version-management/` |
| §63-§68 漂移 / 调试 / 容量 / 异常 / 边缘 | `src/ops-maturity/` 各子模块 |

结论：v2.0 报告应被视为“历史问题扫描”，不能再直接用作当前缺口清单。

---

## 3. 本轮完成的真实缺口

### 3.1 代码与测试补强

| 项目 | 处理结果 |
| --- | --- |
| Marketplace Pack 安全扫描缺少针对性回归 | 已补 `tests/unit/scale-ecosystem/marketplace/pack-security-service.test.ts` |
| SAML 服务缺少专门单测 | 已补 `tests/unit/org-governance/sso-scim/saml/saml-service.test.ts` |
| Pack checksum 仅有字段、缺少完整性校验 | 已在 `src/scale-ecosystem/marketplace/pack-security-service.ts` 增加 checksum 格式校验与 `inline:` 负载一致性校验 |

新增回归覆盖：

- malformed checksum fail-close
- inline source checksum mismatch fail-close
- 高风险权限与依赖冲突检测
- `exec` + `exec:bash` 组合拒绝
- SAML login / assertion / logout 正向链路
- issuer / fingerprint / audience / subject / time-window 拒绝路径

### 3.2 Contract 缺口补齐

v2.0 明确标注缺失、且当前仓库确实不存在的 contract，已补齐：

- `docs_zh/contracts/cache_contract.md`
- `docs_zh/contracts/model_gateway_routing_contract.md`
- `docs_zh/contracts/prompt_engine_spi_contract.md`
- `docs_zh/contracts/sdk_surface_contract.md`

并同步修正 `docs_zh/contracts/README.md` 索引与 `error_code_registry_contract.md` 命名引用。

### 3.3 文档一致性修正

本轮已修正的关键文档：

- `docs_zh/architecture/03-module-diagrams.md`
  - 更新配套文档引用到 `00/01/02`
- `docs_zh/contracts/project_structure_contract.md`
  - 与当前 `src/` / `config/` 结构重新对齐
- `docs_zh/adr/README.md`
  - 修正 ADR-003 文件名链接
  - 取消“编号必须连续递增”的错误表述
- `docs_zh/operations/src_module_test_matrix.md`
  - 从旧 `src/core/`/`src/gateway/` 清单改为当前仓库结构矩阵摘要
- `docs_zh/operations/operations-checklist.md`
  - 修正目录前缀与错误码 contract 引用

---

## 4. 当前状态判定

### 4.1 代码状态

当前 review 涉及的核心功能缺口已关闭；未再发现需要按“新增模块/新增服务”级别继续补开发的阻塞项。

### 4.2 测试状态

本轮新增测试覆盖了先前真实空白区；其余大部分 review 条目对应模块原本已具备 unit / integration 回归。

### 4.3 文档状态

当前 authoritative 入口应以以下链路为准：

1. `docs_zh/architecture/00-04`
2. `docs_zh/adr/README.md`
3. `docs_zh/contracts/README.md`
4. `docs_zh/analysis/00-architecture-coverage-matrix.md`
5. 本报告

---

## 5. 维护建议

- 后续若继续做 gap review，先以 `src/` 和 `tests/` 复核实际实现，再写“missing”结论。
- `reviews/` 只保留“当前有效结论”，不要继续堆叠历史误报。
- 若 contract / ADR / 实现任一层发生变更，必须同时回写 `README` 索引和覆盖矩阵。

---

## 6. 本轮交付清单

### 代码

- `src/scale-ecosystem/marketplace/pack-security-service.ts`

### 测试

- `tests/unit/scale-ecosystem/marketplace/pack-security-service.test.ts`
- `tests/unit/org-governance/sso-scim/saml/saml-service.test.ts`

### 文档

- `docs_zh/contracts/cache_contract.md`
- `docs_zh/contracts/model_gateway_routing_contract.md`
- `docs_zh/contracts/prompt_engine_spi_contract.md`
- `docs_zh/contracts/sdk_surface_contract.md`
- `docs_zh/contracts/README.md`
- `docs_zh/contracts/project_structure_contract.md`
- `docs_zh/architecture/03-module-diagrams.md`
- `docs_zh/adr/README.md`
- `docs_zh/operations/src_module_test_matrix.md`
- `docs_zh/operations/operations-checklist.md`
- `docs_zh/reviews/architecture-design-vs-implementation-review.md`
