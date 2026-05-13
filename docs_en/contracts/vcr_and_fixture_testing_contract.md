# VCR And Fixture Testing Contract

---

## OAPEFLIR Association

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

This contract defines record / replay and fixture rules for providers, LLMs, streaming outputs, and external APIs in testing.

Related documents:

- `testing_singleton_reset_contract.md`
- `tool_and_provider_execution_contract.md`
- `gateway_streaming_contract.md`
- `cost_and_budget_contract.md`

## 2. Objectives

The VCR / fixture testing system must at least achieve:

- CI does not depend on real providers to run the main test suite.
- Regression test results are stable and replayable.
- Clear boundaries between real request recording and offline replay.

## 3. Test Modes

### 3.1 `fixture_only`

- Only uses static fixtures
- Default CI main mode

### 3.2 `vcr_replay`

- Replays existing recorded results based on request fingerprint
- Fails if recording is missing

### 3.3 `vcr_record`

- Allows real provider calls during local development
- Records request/response as fixture

## 4. `RecordedInteraction`

| Field | Type | Description |
| --- | --- | --- |
| `interaction_id` | `string` | Recording ID |
| `provider` | `string` | Provider identifier |
| `model` | `string` | Model name |
| `request_fingerprint` | `string` | Normalized request fingerprint |
| `request_summary` | `json` | Sanitized request summary |
| `response_payload` | `json` | Response body |
| `stream_chunks` | `json[]?` | Streaming chunks |
| `usage_snapshot` | `json?` | Token / cost information |
| `recorded_at` | `timestamp` | Recording time |

## 5. Request Fingerprint Rules

Request fingerprint must contain at least:

- Provider
- Model
- System / user prompt normalized text
- Tool list signature
- Key parameters (temperature, reasoning level, etc.)

Rules:

- Must not directly include volatile fields without semantic value in fingerprint.
- Credential sanitization must be completed before fingerprint generation.

## 6. Fixture Directory Rules

Recommended directories:

- `tests/__fixtures__/llm/`
- `tests/__fixtures__/vcr/`
- `tests/__fixtures__/gateway/`

Rules:

- Fixtures should be named by scenario, not just by timestamp.
- Similar fixtures should show corresponding tasks, roles, or failure scenarios.

## 7. Streaming Response Rules

- Streaming responses can be recorded as chunk lists
- Replay must maintain order, end signal, and finish reason consistency
- Does not require token-by-token exact match, but must satisfy upper-layer protocol assertions

## 8. Security and Sanitization

- API key, cookie, token, and Authorization header must be removed before recording
- Raw sensitive requests must not directly enter repository fixtures
- If safe sanitization is not possible, recording should be prohibited and manual mock required

## 9. Failure Semantics

- When `vcr_replay` mode lacks matching fixture, test must fail
- When fixture schema is illegal, test must fail
- When replay result is incompatible with current protocol, should prompt to re-record or upgrade fixture version

## 10. Layering with Real Tests

Recommended layering:

- Unit / integration: default `fixture_only`
- E2E: prioritize `vcr_replay`
- Nightly / manual eval: can allow real providers

## 11. Cost and Governance

- Cost of recording real providers must be traceable
- `vcr_record` should not be enabled by default in CI
- Re-recording must have clear trigger conditions, such as model upgrade, protocol change, or core prompt change

## 12. Phase Boundaries

Phase 1a does:

- `fixture_only`
- Non-streaming provider replay
- Fail when fixture is missing

Phase 1b does:

- `vcr_replay`
- Streaming chunk replay
- More complete request fingerprint and recording governance

Currently does not do:

- Large-scale fixture auto-update service
- Cross-provider difference normalization auto-fix
- Enterprise dataset evaluation platform

## 13. Closure Conclusion

The core of VCR / fixture is not "storing one call", but transforming external unstable dependencies into a controllable, replayable, and auditable test input.