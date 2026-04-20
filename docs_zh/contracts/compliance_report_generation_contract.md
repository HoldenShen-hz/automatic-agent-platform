# Compliance Report Generation Contract

## 1. 范围

本 contract 定义 `§66` 的报告模板注册、证据映射和报告生成管线。

## 2. Canonical 对象

- `ComplianceReportTemplate`
- `EvidenceMappingRule`
- `ComplianceReportRequest`
- `ComplianceReportArtifact`

## 3. `ComplianceReportTemplate` 最小字段

- `template_id`
- `framework`
- `report_type`
- `required_evidence_types`
- `render_schema`
- `version`

## 4. 规则

- 报告必须引用真实 evidence artifact，不得手工伪造合规结论。
- 缺失 evidence 时必须给出缺口说明。
- 审计员访问报告必须是只读且可审计。

## 5. 测试要求

- unit：template validation、evidence mapping、render completeness
- integration：evidence store -> report pipeline
- contract：缺证据报告不得标记为 complete

