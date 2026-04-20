# Compliance Report Generation Contract

## 1. Scope

This contract defines report template registration, evidence mapping, and report generation pipeline for `§66`.

## 2. Canonical Objects

- `ComplianceReportTemplate`
- `EvidenceMappingRule`
- `ComplianceReportRequest`
- `ComplianceReportArtifact`

## 3. `ComplianceReportTemplate` Minimum Fields

- `template_id`
- `framework`
- `report_type`
- `required_evidence_types`
- `render_schema`
- `version`

## 4. Rules

- Reports must reference real evidence artifacts; compliance conclusions must not be fabricated manually.
- Missing evidence must be accompanied by a gap explanation.
- Auditor access to reports must be read-only and auditable.

## 5. Test Requirements

- unit: template validation, evidence mapping, render completeness
- integration: evidence store -> report pipeline
- contract: reports with missing evidence must not be marked as complete