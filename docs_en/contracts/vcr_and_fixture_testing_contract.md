# VCR And Fixture Testing Contract

## 1. Scope

This contract defines record / replay and fixture rules for providers, LLMs, streaming output, and external APIs in testing.

Related documents:

- `testing_singleton_reset_contract.md`
- `tool_and_provider_execution_contract.md`
- `gateway_streaming_contract.md`
- `cost_and_budget_contract.md`

## 2. Goals

The VCR / fixture testing system must at least achieve:

- CI does not depend on real providers to run the main test suite.
- Regression test results are stable and reproducible.
- Clear boundary between real request recording and offline replay.

## 3. Test Modes

### 3.1 `fixture_only`

- Uses only static fixtures
- Default CI main mode

### 3.2 `vcr_replay`

- Replays existing recording results based on request fingerprint
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

Request fingerprints must at least include:

- provider
- model
- system / user prompt normalized text
- tool list signature
- Key parameters (temperature, reasoning level, etc.)

Rules:

- Volatile fields without semantic value must not be directly included in fingerprints.
- Credentials must be sanitized before fingerprint generation.

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
- Token-by-token exact match is not required, but must satisfy upper-layer protocol assertions

## 8. Security and Sanitization

- API keys, cookies, tokens, and Authorization headers must be removed before recording
- Raw sensitive requests must not directly enter repository fixtures
- If safe sanitization is not possible, recording should be prohibited and manual mock required

## 9. Failure Semantics

- `vcr_replay` mode must fail when matching fixture is missing
- Test must fail when fixture schema is invalid
- When replay result is incompatible with current protocol, should prompt to re-record or upgrade fixture version

## 10. Layering with Real Tests

Recommended layering:

- unit / integration: default `fixture_only`
- e2e: prefer `vcr_replay`
- nightly / manual eval: may allow real providers

## 11. Cost and Governance

- Cost of recording real providers must be traceable
- `vcr_record` should not be enabled by default in CI
- Re-recording must have clear triggering conditions, such as model upgrade, protocol change, or core prompt change

## 12. Phase Boundaries

Phase 1a does:

- `fixture_only`
- Non-streaming provider replay
- Fail on missing fixture

Phase 1b does:

- `vcr_replay`
- Streaming chunk replay
- More complete request fingerprints and recording governance

Currently does not do:

- Large-scale fixture auto-update service
- Cross-provider difference normalization auto-fix
- Enterprise dataset evaluation platform

## 13. Conclusion

The core of VCR / fixture is not “storing one call”, but transforming external unstable dependencies into a controllable, reproducible, and auditable test input.
