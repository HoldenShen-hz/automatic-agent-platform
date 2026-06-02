# VCR And Fixture Testing Contract

---

## OAPEFLIR Mapping

This contract participates in the following stages of the OAPEFLIR eight-stage loop:

- **Observe**: signal collection and aggregation
- **Assess**: pre-execution evaluation and risk judgement
- **Plan**: task decomposition and DAG construction
- **Execute**: step execution and fault tolerance
- **Feedback**: signal collection and preprocessing
- **Learn**: pattern detection and knowledge extraction
- **Improve**: improvement candidate evaluation and rollout
- **Release**: controlled release and rollback

---

## 1. Scope

This contract defines record / replay and fixture rules for provider, LLM, streaming output, and external API in tests.

Related documents:

- `testing_singleton_reset_contract.md`
- `tool_and_provider_execution_contract.md`
- `gateway_streaming_contract.md`
- `cost_and_budget_contract.md`

## 2. Goals

The VCR / fixture testing system must at least achieve:

- CI can run the main test suite without depending on real providers.
- Regression test results are stable and replayable.
- The boundary between real request recording and offline replay is clear.

## 3. Test Modes

### 3.1 `fixture_only`

- Only use static fixtures
- Default CI main mode

### 3.2 `vcr_replay`

- Replay existing recording results based on the request fingerprint
- Fail if recording is missing

### 3.3 `vcr_record`

- Allow real calls to the provider during local development
- Record the request / response as a fixture

## 4. `RecordedInteraction`

| Field | Type | Description |
| --- | --- | --- |
| `interaction_id` | `string` | Recording ID |
| `provider` | `string` | Provider identifier |
| `model` | `string` | Model name |
| `request_fingerprint` | `string` | Normalized request fingerprint |
| `request_summary` | `json` | Desensitized request summary |
| `response_payload` | `json` | Response body |
| `stream_chunks` | `json[]?` | Stream chunks |
| `usage_snapshot` | `json?` | Token / cost information |
| `recorded_at` | `timestamp` | Recording time |

## 5. Request Fingerprint Rules

The request fingerprint should at least include:

- provider
- model
- normalized system / user prompt text
- tool list signature
- key parameters (temperature, reasoning level, etc.)

Rules:

- Fields that are volatile but of no semantic value must not be directly included in the fingerprint.
- Credential desensitization must be completed before fingerprint generation.

## 6. Fixture Directory Rules

Recommended directories:

- `tests/__fixtures__/llm/`
- `tests/__fixtures__/vcr/`
- `tests/__fixtures__/gateway/`

Rules:

- Fixtures should be named by scenario, rather than only by timestamp.
- Similar fixtures should be able to identify the corresponding task, role, or failure scenario.

## 7. Streaming Response Rules

- Streaming responses can be recorded as a chunk list
- During replay, the order, end signal, and finish reason must remain consistent
- Exact token-by-token match is not required, but the upper-layer protocol assertions must be met

## 8. Security and Desensitization

- API key, cookie, token, and Authorization header must be removed before recording
- Raw sensitive requests must not directly enter the repository fixtures
- If safe desensitization is not possible, recording should be prohibited and manual mock is required

## 9. Failure Semantics

- When the `vcr_replay` mode is missing a matching fixture, the test must fail
- When the fixture schema is invalid, the test must fail
- When the replay result is incompatible with the current protocol, it should prompt to re-record or upgrade the fixture version

## 10. Layering with Real Tests

Recommended layering:

- unit / integration: default `fixture_only`
- e2e: prefer `vcr_replay`
- nightly / manual eval: real provider is allowed

## 11. Cost and Governance

- The cost of recording real providers must be traceable
- `vcr_record` should not be enabled by default in CI
- Re-recording must have clear trigger conditions, such as model upgrade, protocol change, or core prompt change

## 12. Phase Boundary

Phase 1a does:

- `fixture_only`
- Non-streaming provider replay
- Fail when fixture is missing

Phase 1b does:

- `vcr_replay`
- Stream chunk replay
- More complete request fingerprint and recording governance

Currently not doing:

- Large-scale fixture auto-update service
- Cross-provider difference normalization auto-repair
- Enterprise-level dataset evaluation platform

## 13. Closure Conclusion

The core of VCR / fixture is not "save one call", but to turn external unstable dependencies into a set of controllable, replayable, and auditable test inputs.
