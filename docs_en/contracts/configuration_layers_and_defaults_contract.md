# Configuration Layers And Defaults Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR 8-stage loop:

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

This contract defines configuration layering, override priority, prompt / config / policy / flag decoupling rules, and the defaults registry.

Related Documents:

- `project_structure_contract.md`
- `policy_engine_contract.md`
- `division_definition_contract.md`
- `adr/006-llm-provider-strategy.md`

## 2. Configuration Five Layers

- `system config`
- `domain config`
- `division config`
- `role config`
- `runtime override`

Priority chain:

`runtime override > role config > division config > domain config > system config > default registry`

## 3. Four Types of Responsibility Separation

- prompt: behavioral tendency and expression
- config: structure and organizational relationships
- policy: strong constraints
- feature flag: enable/disable control

Rules:

- Runtime strong constraints must not only be written in prompt.
- Feature flag does not replace permissions and policies.
- Config cannot be used to secretly override policy decisions.

## 3A. Configuration Governance Bundle

The configuration governance layer uniformly loads and validates all configuration layers through `ConfigBundle`. The current phase must contain the following 10 layers:

| Layer Name | File Path | Responsibilities |
| --- | --- | --- |
| `bootstrap` | `config/bootstrap/default.json` | Application identity, phase declaration, feature switches |
| `gateways` | `config/gateways/default.json` | API gateway and channel adapter configuration |
| `domains` | `config/domains/default.json` | domain/tool bundle/plugin/namespace default configuration |
| `knowledge` | `config/knowledge/default.json` | knowledge namespace, trust, freshness configuration |
| `memory` | `config/memory/default.json` | memory layer, promotion, decay configuration |
| `kvcache` | `config/kvcache/default.json` | fixed prefix / domain block / variable suffix budget strategy |
| `providers` | `config/providers/default.json` | LLM provider connection and profile selection |
| `runtime` | `config/runtime/default.json` | Runtime parameters: timeout, concurrency, agent rounds, tool calls |
| `security` | `config/security/default.json` | Sandbox mode, approval mode, remote worker registration strategy |
| `workflows` | `config/workflows/default.json` | Workflow definitions and default step templates |

### 3A.1 Configuration Versioning

- System generates `configVersion` by taking the first 16 characters of SHA256 after deterministic JSON serialization of the bundle.
- `configVersion` is used for tamper detection: if the runtime bundle's recalculated version does not match the recorded version, doctor should report `config.version_tampered`.

### 3A.2 Validation Rules

| Layer | Validation Item | Rule |
| --- | --- | --- |
| All layers | Existence | When any required layer is missing, report `config.missing_layer:{layerName}` |
| `runtime` | `defaultTaskTimeoutMs` | Must be a positive number |
| `runtime` | `defaultStepTimeoutMs` | Must be a positive number |
| `runtime` | `maxConcurrentTasks` | Must be a positive integer |
| `security` | `sandboxMode` | Must be one of `read_only \| workspace_write \| scoped_external_access \| restricted_exec` |
| `security` | `remoteWorkerRegistration.challengeTtlMs` | Must be a positive number |
| `security` | `remoteWorkerRegistration.allowedCapabilities` | Must be a non-empty string array |
| `providers` | provider / profile references | Must have matching entries in model metadata registry |
| `domains` | domain/tool bundle/plugin refs | Must be consistent with registry |
| `knowledge` | namespace / trust tier | Must satisfy enum and boundary constraints |
| `kvcache` | budget partition | fixed/domain/variable three-segment budget sum must be explainable |
| Production | `allowDestructiveActions` | Must not be `true` (fail-closed) |

### 3A.3 JSONC Support

Configuration files support `//` line comments, `/* */` block comments, and trailing commas. Parse by stripping comments first, then doing JSON parse.

### 3A.4 Sandbox Path Constraints

Configuration file loading paths must be within the config root directory; reading files outside the config directory via `../` or other path traversal is prohibited.

## 4. Defaults Registry

At least uniformly manage:

- timeout defaults
- retry defaults
- queue limit defaults
- cost guard defaults
- heartbeat defaults

## 5. Provider / Model Metadata Registry

Metadata involving model selection, budget, context limits, modalities, and provider authentication methods must not be hardcoded scattered at call sites.

At minimum, unified registry should manage:

- `provider_id`
- `model_id`
- `capability_labels`
- `context_limit`
- `max_output_limit`
- `pricing`
- `modalities`
- `auth_methods`
- `status` (`active | degraded | disabled | deprecated`)
- `metadata_source` (`bundled_snapshot | local_override | remote_refresh`)
- `tier` (`reasoning | coding | balanced | fast`)
- `kv_cache_support` (`none | prefix_only | segmented`)

### 5.1 Model Tier Semantics

| tier | Applicable Scenarios |
| --- | --- |
| `reasoning` | Complex tasks requiring deep reasoning |
| `coding` | Code generation and editing tasks |
| `balanced` | General tasks, balance of capability and cost |
| `fast` | Lightweight tasks prioritizing low latency response |

### 5.2 Metadata Source Priority

- System built-in `bundled_snapshot` (with snapshot date, e.g., `2026-04-05.bundled`) serves as offline baseline.
- When local `config/providers/models.json` exists, it overrides built-in snapshot (`local_override`).
- Remote refresh is reserved for future expansion (`remote_refresh`).
- When local file does not exist, silently fall back to built-in snapshot without error.

Rules:

- Registry can support local snapshots, offline use, and remote refresh, but authoritative field shape must be stable.
- Runtime must not use string contains check to replace formal capability metadata, unless it belongs to short-term compatibility layer.
- UI, CLI, server, policy, budget, and provider routing should preferentially consume unified registry, rather than each maintaining their own model list.

## 6. Conclusion

The biggest risk in the configuration system is not "too many configuration items", but defaults, prompts, YAML, and policies competing for authority; this contract is to nail down their hierarchy.