# ADR-066 Compliance Report Auto-Generation Engine

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Compliance audits require large amounts of evidence materials, and manual organization is inefficient and error-prone.

## Decision

### Report Types

| Type | Frequency | Audience |
|------|-----------|----------|
| Audit Log Report | Real-time | Auditors |
| Compliance Summary | Monthly | Compliance Team |
| Risk Assessment Report | Quarterly | Management |
| Incident Report | Event-driven | Regulatory Bodies |

### Evidence Collection

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

### Report Generation Flow

1. Trigger condition met
2. Evidence collection
3. Data validation
4. Template population
5. Signing and sealing
6. Distribution and archiving

### Report Content

| Content | Description |
|---------|-------------|
| Executive Summary | Key findings |
| Evidence Inventory | Detailed evidence |
| Compliance Assessment | Clause-by-clause evaluation |
| Anomaly Records | Deviations and remediation |
| Signatures | Responsible party signatures |

### Compliance Framework Mapping

| Framework | Requirements |
|-----------|--------------|
| EU AI Act | Art. 12, 13, 14 |
| GDPR | Art. 5, 30, 35 |
| SOC 2 | CC1, CC2, CC6 |

## Consequences

Benefits:

- Automation improves efficiency
- Reduces human error
- Meets regulatory requirements

Costs:

- Evidence collection adds system overhead
- Report templates require maintenance

## Cross-References

- [ADR-059 Agent Explainability](./059-agent-explainability-and-decision-transparency.md)
- [ADR-085 Organization Governance and Knowledge Boundary](./085-organization-governance-and-knowledge-boundary.md)
- [Platform Architecture §23 Compliance and Data Governance](../architecture/00-platform-architecture.md)

## Source Section

- `§66` Compliance Report Auto-Generation Engine

## v4.3 ADR Remediation

- R5-65: This ADR originally referenced non-existent Appendix `§B`/`§G`, which have been removed. The compliance framework mapping content is retained, but reference paths have been corrected to point to actually existing documents.