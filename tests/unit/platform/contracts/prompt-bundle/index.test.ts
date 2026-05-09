import assert from "node:assert/strict";
import test from "node:test";

import {
  createPromptBundle,
  validatePromptBundle,
  validatePromptBundleRegistrationInput,
  type PromptBundle,
  type PromptBundleCompatibilityMatrix,
  type PromptBundleListResult,
  type PromptBundleMetadata,
  type PromptBundleRegistrationInput,
  type PromptBundleVersion,
} from "../../../../../src/platform/contracts/prompt-bundle/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

function createCompatibilityMatrix(): PromptBundleCompatibilityMatrix {
  return {
    toolSchemaVersions: [{ toolName: "shell", schemaVersion: 1 }],
    evaluatorSchemaVersions: [{ evaluatorName: "safety", schemaVersion: 2 }],
    domainDescriptorVersions: [{ domainId: "platform", version: 3 }],
    modelRoutingProfiles: [{ modelId: "gpt-5.4", profileVersion: 1 }],
  };
}

function createRegistrationInput(
  overrides: Partial<PromptBundleRegistrationInput> = {},
): PromptBundleRegistrationInput {
  return {
    name: "assistant-core",
    version: 3,
    displayVersion: "3.0.0",
    domain: "assistant",
    taskType: "chat",
    packId: "pack-assistant",
    systemPrompt: {
      content: "You are a precise assistant.",
      templateVariables: ["tenantName"],
      channel: "system",
    },
    userPrompt: {
      content: "Help with {{task}}",
      templateVariables: ["task"],
      channel: "user",
    },
    fewShotExamples: [
      {
        exampleId: "fewshot-1",
        input: "hello",
        output: "hi",
        explanation: "basic greeting",
        tags: ["greeting"],
      },
    ],
    constraints: {
      maxTokens: 2048,
      temperature: 0.2,
      topP: 0.95,
      stopSequences: ["END"],
      responseFormat: "markdown",
      customConstraints: { style: "concise" },
    },
    compatibilityMatrix: createCompatibilityMatrix(),
    metadata: {
      owner: "platform-team",
      deprecated: false,
      lifecycleStatus: "active",
      tags: ["stable"],
      compatibilityTags: ["core"],
      trafficAllocation: {
        weight: 100,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
    ...overrides,
  };
}

test("createPromptBundle builds a normalized bundle with defaults", () => {
  const bundle = createPromptBundle(
    createRegistrationInput({
      packId: undefined,
      userPrompt: undefined,
      fewShotExamples: undefined,
      constraints: undefined,
      metadata: undefined,
    }),
  );

  assert.ok(bundle.bundleId.startsWith("promptbundle_"));
  assert.equal(bundle.version, 3);
  assert.equal(bundle.displayVersion, "3.0.0");
  assert.equal(bundle.packId, undefined);
  assert.equal(bundle.userPrompt, undefined);
  assert.deepEqual(bundle.fewShotExamples, []);
  assert.equal(bundle.metadata.owner, "system");
  assert.equal(bundle.metadata.lifecycleStatus, "active");
  assert.equal(bundle.metadata.trafficAllocation.weight, 100);
  assert.deepEqual(bundle.constraints.customConstraints, {});
});

test("createPromptBundle preserves provided metadata, constraints, and compatibility matrix", () => {
  const input = createRegistrationInput();
  const bundle = createPromptBundle(input);

  assert.equal(bundle.metadata.owner, "platform-team");
  assert.equal(bundle.constraints.maxTokens, 2048);
  assert.equal(bundle.compatibilityMatrix.toolSchemaVersions[0]?.toolName, "shell");
  assert.equal(bundle.fewShotExamples[0]?.exampleId, "fewshot-1");
});

test("validatePromptBundleRegistrationInput rejects empty required fields", () => {
  assert.throws(
    () =>
      validatePromptBundleRegistrationInput(
        createRegistrationInput({ name: "   " }),
      ),
    ValidationError,
  );
  assert.throws(
    () =>
      validatePromptBundleRegistrationInput(
        createRegistrationInput({ displayVersion: "" }),
      ),
    ValidationError,
  );
  assert.throws(
    () =>
      validatePromptBundleRegistrationInput(
        createRegistrationInput({ domain: "" }),
      ),
    ValidationError,
  );
});

test("validatePromptBundleRegistrationInput rejects non-positive integer version", () => {
  assert.throws(
    () =>
      validatePromptBundleRegistrationInput(
        createRegistrationInput({ version: 0 }),
      ),
    ValidationError,
  );
  assert.throws(
    () =>
      validatePromptBundleRegistrationInput(
        createRegistrationInput({ version: 1.5 }),
      ),
    ValidationError,
  );
});

test("createPromptBundle derives deprecated lifecycle status when legacy flag is set", () => {
  const bundle = createPromptBundle(
    createRegistrationInput({
      metadata: {
        owner: "legacy-team",
        deprecated: true,
        lifecycleStatus: "deprecated",
        tags: [],
        compatibilityTags: [],
        trafficAllocation: {
          weight: 0,
          startTime: undefined,
          endTime: undefined,
          targeting: undefined,
        },
      },
    }),
  );

  assert.equal(bundle.metadata.deprecated, true);
  assert.equal(bundle.metadata.lifecycleStatus, "deprecated");
});

test("validatePromptBundle rejects invalid traffic allocation weight", () => {
  const bundle = createPromptBundle(createRegistrationInput());
  assert.throws(
    () =>
      validatePromptBundle({
        ...bundle,
        metadata: {
          ...bundle.metadata,
          trafficAllocation: {
            ...bundle.metadata.trafficAllocation,
            weight: 101,
          },
        },
      }),
    ValidationError,
  );
});

test("PromptBundleVersion reflects integer version and displayVersion", () => {
  const version: PromptBundleVersion = {
    version: 3,
    displayVersion: "3.0.0",
    isCurrent: true,
    isDefault: false,
    trafficWeight: 75,
    createdAt: "2026-01-15T00:00:00.000Z",
    deprecated: false,
    lifecycleStatus: "active",
  };

  assert.equal(version.version, 3);
  assert.equal(version.displayVersion, "3.0.0");
  assert.equal(version.lifecycleStatus, "active");
});

test("PromptBundleListResult stores bundle and current display lineage", () => {
  const bundle = createPromptBundle(createRegistrationInput({ bundleId: "bundle-123" }));
  const availableVersions: PromptBundleVersion[] = [
    {
      version: 3,
      displayVersion: "3.0.0",
      isCurrent: true,
      isDefault: true,
      trafficWeight: 100,
      createdAt: bundle.createdAt,
      deprecated: false,
      lifecycleStatus: "active",
    },
  ];
  const result: PromptBundleListResult = {
    bundle,
    availableVersions,
    currentVersion: "3",
  };

  assert.equal(result.bundle.bundleId, "bundle-123");
  assert.equal(result.availableVersions[0]?.displayVersion, "3.0.0");
  assert.equal(result.currentVersion, "3");
});

test("PromptBundle interface supports full object shape", () => {
  const metadata: PromptBundleMetadata = {
    owner: "platform-team",
    deprecated: false,
    lifecycleStatus: "active",
    tags: ["stable"],
    compatibilityTags: ["core"],
    trafficAllocation: {
      weight: 100,
      startTime: undefined,
      endTime: undefined,
      targeting: undefined,
    },
  };

  const bundle: PromptBundle = createPromptBundle(
    createRegistrationInput({
      bundleId: "bundle-shape",
      metadata,
    }),
  );

  assert.equal(bundle.bundleId, "bundle-shape");
  assert.equal(bundle.metadata.owner, "platform-team");
  assert.equal(bundle.systemPrompt.channel, "system");
});
