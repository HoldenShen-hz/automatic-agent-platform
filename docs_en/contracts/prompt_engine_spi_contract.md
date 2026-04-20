# Prompt Engine SPI Contract

## 1. Scope

This contract defines the registry, renderer, version, rollout, and evaluation side boundaries for `src/platform/prompt-engine/`.

Related documents:

- `prompt_model_policy_governance_contract.md`
- `quality_engineering_and_chaos_testing_contract.md`
- `domain_descriptor_and_onboarding_contract.md`

## 2. Prompt Definition Object

```typescript
interface PromptDefinition {
  promptId: string;
  version: string;
  owner: string;
  domainId: string | null;
  fixedPrefix: string;
  domainBlock: string | null;
  variableTemplate: string;
  labels: string[];
  reviewStatus: "draft" | "reviewed" | "approved" | "deprecated";
}
```

## 3. Registry SPI

```typescript
interface PromptRegistry {
  register(definition: PromptDefinition): Promise<void>;
  get(promptId: string, version?: string): Promise<PromptDefinition | null>;
  list(filter?: { domainId?: string; owner?: string }): Promise<PromptDefinition[]>;
}
```

Rules:

- `promptId + version` together form a stable primary key.
- Any change to `fixedPrefix`, `domainBlock`, or `variableTemplate` must go through a new version or explicit rollout.
- Versions with `reviewStatus !== approved` must not enter the production `stable` route.

## 4. Renderer SPI

```typescript
interface PromptRenderRequest {
  promptId: string;
  version: string | null;
  inputs: Record<string, unknown>;
  locale: string | null;
  mode: "runtime" | "preview" | "eval";
}

interface PromptRenderResult {
  promptId: string;
  resolvedVersion: string;
  renderedPrompt: string;
  fixedPrefixHash: string;
  tokenEstimate: number | null;
}
```

Rules:

- Renderer must return `resolvedVersion`; returning only the final string is prohibited.
- Changes to `fixedPrefixHash` must trigger cache invalidation and regression evaluation.
- `preview` must not write to production rollout or evidence state.

## 5. Rollout and Evaluation

```typescript
interface PromptReleaseDecision {
  promptId: string;
  fromVersion: string;
  toVersion: string;
  stage: "off" | "shadow" | "canary" | "partial" | "stable";
  evalEvidenceIds: string[];
  approvedBy: string | null;
}
```

Rules:

- Prompt rollout must be accompanied by evaluation evidence or an explicit exemption reason.
- Domain-specific prompts must align with the compatible version of the `domain descriptor`.
- Rollback must reference the last stable version, not a temporary string patch.

## 6. Testing Requirements

- unit: prompt registration, version resolution, render output, and hash stability.
- integration: prompt rollout drives cache invalidation, eval evidence, and domain compatibility checks.
- contract: registry / renderer / rollout output object fields are stable and do not drift based on the calling endpoint.