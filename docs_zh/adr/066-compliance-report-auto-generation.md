# ADR-066 合规报告自动生成引擎

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

合规审计需要大量证据材料，人工整理效率低且容易出错。

## 决策

### 报告类型

| 类型 | 周期 | 受众 |
|------|------|------|
| 审计日志报告 | 实时 | 审计员 |
| 合规摘要 | 月度 | 合规团队 |
| 风险评估报告 | 季度 | 管理层 |
| 事件报告 | 事件驱动 | 监管机构 |

### 证据采集

```typescript
interface ComplianceEvidence {
  evidence_id: string;
  type: EvidenceType;
  source: EvidenceSource;
  timestamp: string;
  data: unknown;
  integrity_hash: string;
}

type EvidenceType =
  | 'audit_log'
  | 'access_record'
  | 'data_processing'
  | 'consent_record'
  | 'breach_notification';
```

### 报告生成流程

1. 触发条件满足
2. 证据采集
3. 数据验证
4. 模板填充
5. 签名和盖章
6. 分发和存档

### 报告内容

| 内容 | 说明 |
|------|------|
| 执行摘要 | 关键发现 |
| 证据清单 | 详细证据 |
| 符合性评估 | 各条款评估 |
| 异常记录 | 偏差和补救 |
| 签名 | 责任人签署 |

### 合规框架映射

| 框架 | 要求 |
|------|------|
| EU AI Act | Art. 12, 13, 14 |
| GDPR | Art. 5, 30, 35 |
| SOC 2 | CC1, CC2, CC6 |

## 后果

优点：

- 自动化提高效率
- 减少人工错误
- 满足法规要求

代价：

- 证据采集增加系统开销
- 报告模板需要维护

## 交叉引用

- [ADR-059 Agent 可解释性](./059-agent-explainability-and-decision-transparency.md)
- [ADR-085 组织治理与知识边界](./085-organization-governance-and-knowledge-boundary.md)
- [平台架构 §23 合规与数据治理](../architecture/00-platform-architecture.md)

## 来源章节

- `§66` 合规报告自动生成引擎

## v4.3 ADR Remediation

- R5-65: 本 ADR 原先引用不存在的 `§B`/`§G` 附录，已移除。合规框架映射内容保留，但引用路径已更正为实际存在的文档。
