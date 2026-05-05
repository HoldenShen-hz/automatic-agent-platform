# Prompt Engine SPI Contract

## 1. 范围

本 contract 定义 `src/platform/prompt-engine/` 的 registry、renderer、version、release 与评测侧边界。

相关文档：

- `prompt_model_policy_governance_contract.md`
- `quality_engineering_and_chaos_testing_contract.md`
- `domain_descriptor_and_onboarding_contract.md`

## 2. Prompt 定义对象

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

规则：

- `promptId + version` 组成稳定主键。
- `fixedPrefix`、`domainBlock`、`variableTemplate` 任一变化都必须走新版本或明确 release。
- `reviewStatus !== approved` 的版本不得进入生产 `stable` 路由。

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

规则：

- renderer 必须返回 `resolvedVersion`，禁止只返回最终字符串。
- `fixedPrefixHash` 变化必须触发 cache invalidation 与 regression 评估。
- `preview` 不得写入生产 release 或 evidence 状态。

## 5. Rollout 与评测

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

规则：

- prompt release 必须附带评测证据或显式豁免原因。
- domain 专属 prompt 必须与 `domain descriptor` 的兼容版本对齐。
- 回滚必须引用上一个稳定版本，而不是临时字符串 patch。

## 6. 测试要求

- unit：prompt 注册、版本解析、render 输出与 hash 稳定性。
- integration：prompt release 驱动缓存失效、eval 证据、domain 兼容检查。
- contract：registry / renderer / release 输出对象字段稳定，不因调用端不同而漂移。
