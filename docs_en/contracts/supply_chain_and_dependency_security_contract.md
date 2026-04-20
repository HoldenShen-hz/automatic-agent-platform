# Supply Chain And Dependency Security Contract

---

## OAPEFLIR Related

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines supply chain security baseline for dependencies, plugins, skills, MCP, and third-party distribution units.

Related documents:

- `tool_skill_plugin_contract.md`
- `ecosystem_extension_plane_contract.md`
- `enterprise_secret_management_contract.md`
- `sandbox_and_auth_contract.md`

## 2. Goals

- Reduce supply chain risks introduced by third-party dependencies, plugins, and external execution units.
- Unify rules for installation, updates, signing, scanning, and isolation levels.
- Provide traceable evidence for industrial-grade audit and admission.

## 3. Minimum Requirements

- Dependency locking
- Package source verification
- Signature or integrity verification
- SBOM generation
- Vulnerability scanning
- Third-party plugin isolation levels

## 4. Distribution Unit Classification

| Type | Minimum Requirements |
| --- | --- |
| `first_party tool` | locked dependency + review evidence |
| `skill bundle` | source provenance + permission declaration |
| `plugin bundle` | signature / digest + capability declaration |
| `MCP server` | trust level + isolation level + domain allowlist |

## 5. Isolation Levels

- `trusted_first_party`
- `reviewed_partner`
- `untrusted_third_party`

Rules:

- `untrusted_third_party` must not default to destructive permissions.
- MCP must not impersonate local trusted tool.
- Plugin permissions must not bypass ToolRegistry and Policy Engine.

## 6. Security Check Process

```mermaid
flowchart TD
    A["Import Dependency / Plugin"] --> B["Verify Source / Digest / Signature"]
    B --> C["Generate SBOM / Scan Vulnerabilities"]
    C --> D{"Risk Accepted?"}
    D -- "No" --> E["Reject Install"]
    D -- "Yes" --> F["Assign Isolation Level"]
```

## 7. Audit Requirements

Must record:

- install source
- version / digest
- approver
- granted capability scope
- scan result summary
- disable / revoke action

## 8. Closure Conclusion

Industrial-grade extension ecosystem cannot just ask "can it be installed".

It must simultaneously answer:

- Whether source is trusted
- Whether permissions are minimal
- Whether updates are traceable
- Whether it can be quickly disabled and traced when problems occur
