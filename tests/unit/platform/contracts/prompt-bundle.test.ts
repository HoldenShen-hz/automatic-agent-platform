/**
 * Tests for src/platform/contracts/prompt-bundle/index.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  createPromptBundle,
  validatePromptBundleRegistrationInput,
  validatePromptBundle,
  type PromptBundle,
  type PromptBundleSegment,
  type PromptBundleConstraints,
  type PromptBundleMetadata,
  type PromptBundleTrafficAllocation,
  type TrafficTargeting,
  type PromptLifecycleStatus,
} from "../../../../src/platform/contracts/prompt-bundle/index.js";

describe("contracts/prompt-bundle", () => {
  const validSegment: PromptBundleSegment = {
    content: "You are a helpful assistant.",
    templateVariables: ["name"],
    channel: "system",
  };

  const validMetadata: PromptBundleMetadata = {
    owner: "test-owner",
    deprecated: false,
    lifecycleStatus: "active",
    tags: ["test"],
    compatibilityTags: ["v1"],
    trafficAllocation: {
      weight: 100,
    },
  };

  const validCompatibilityMatrix = {
    toolSchemaVersions: [],
    evaluatorSchemaVersions: [],
    domainDescriptorVersions: [],
    modelRoutingProfiles: [],
  };

  describe("createPromptBundle", () => {
    it("should create a valid prompt bundle with required fields", () => {
      const bundle = createPromptBundle({
        name: "test-bundle",
        version: 1,
        displayVersion: "1.0.0",
        domain: "test-domain",
        taskType: "general",
        systemPrompt: validSegment,
        compatibilityMatrix: validCompatibilityMatrix,
      });

      assert.strictEqual(bundle.name, "test-bundle");
      assert.strictEqual(bundle.version, 1);
      assert.strictEqual(bundle.displayVersion, "1.0.0");
      assert.strictEqual(bundle.domain, "test-domain");
      assert.strictEqual(bundle.taskType, "general");
      assert.ok(bundle.bundleId);
      assert.ok(bundle.createdAt);
      assert.ok(bundle.updatedAt);
    });

    it("should normalize semver string version to integer", () => {
      const bundle = createPromptBundle({
        name: "test-bundle",
        version: "v1",
        displayVersion: "1.0.0",
        domain: "test-domain",
        taskType: "general",
        systemPrompt: validSegment,
        compatibilityMatrix: validCompatibilityMatrix,
      });

      // v1 should normalize to 10
      assert.strictEqual(bundle.version, 10);
    });

    it("should normalize full semver version to integer", () => {
      const bundle = createPromptBundle({
        name: "test-bundle",
        version: "v1.2.3",
        displayVersion: "1.2.3",
        domain: "test-domain",
        taskType: "general",
        systemPrompt: validSegment,
        compatibilityMatrix: validCompatibilityMatrix,
      });

      // v1.2.3 should normalize to 123
      assert.strictEqual(bundle.version, 123);
    });

    it("should use provided bundleId", () => {
      const bundle = createPromptBundle({
        name: "test-bundle",
        version: 1,
        displayVersion: "1.0.0",
        domain: "test-domain",
        taskType: "general",
        systemPrompt: validSegment,
        compatibilityMatrix: validCompatibilityMatrix,
        bundleId: "custom-bundle-id",
      });

      assert.strictEqual(bundle.bundleId, "custom-bundle-id");
    });

    it("should clone system prompt instead of referencing", () => {
      const bundle = createPromptBundle({
        name: "test-bundle",
        version: 1,
        displayVersion: "1.0.0",
        domain: "test-domain",
        taskType: "general",
        systemPrompt: validSegment,
        compatibilityMatrix: validCompatibilityMatrix,
      });

      // Mutating original should not affect bundle
      validSegment.content = "Modified";
      assert.strictEqual(bundle.systemPrompt.content, "You are a helpful assistant.");
    });

    it("should set default metadata when not provided", () => {
      const bundle = createPromptBundle({
        name: "test-bundle",
        version: 1,
        displayVersion: "1.0.0",
        domain: "test-domain",
        taskType: "general",
        systemPrompt: validSegment,
        compatibilityMatrix: validCompatibilityMatrix,
      });

      assert.strictEqual(bundle.metadata.owner, "system");
      assert.strictEqual(bundle.metadata.deprecated, false);
      assert.strictEqual(bundle.metadata.lifecycleStatus, "active");
    });

    it("should use provided metadata", () => {
      const bundle = createPromptBundle({
        name: "test-bundle",
        version: 1,
        displayVersion: "1.0.0",
        domain: "test-domain",
        taskType: "general",
        systemPrompt: validSegment,
        compatibilityMatrix: validCompatibilityMatrix,
        metadata: {
          owner: "custom-owner",
          deprecated: true,
          lifecycleStatus: "deprecated",
          tags: ["custom-tag"],
          compatibilityTags: [],
          trafficAllocation: { weight: 50 },
        },
      });

      assert.strictEqual(bundle.metadata.owner, "custom-owner");
      assert.strictEqual(bundle.metadata.deprecated, true);
      assert.strictEqual(bundle.metadata.lifecycleStatus, "deprecated");
    });

    it("should throw ValidationError when name is empty", () => {
      assert.throws(
        () =>
          createPromptBundle({
            name: "",
            version: 1,
            displayVersion: "1.0.0",
            domain: "test-domain",
            taskType: "general",
            systemPrompt: validSegment,
            compatibilityMatrix: validCompatibilityMatrix,
          }),
        /prompt_bundle.invalid_name/,
      );
    });

    it("should throw ValidationError when systemPrompt content is empty", () => {
      assert.throws(
        () =>
          createPromptBundle({
            name: "test-bundle",
            version: 1,
            displayVersion: "1.0.0",
            domain: "test-domain",
            taskType: "general",
            systemPrompt: { content: "", templateVariables: [], channel: "system" },
            compatibilityMatrix: validCompatibilityMatrix,
          }),
        /prompt_bundle.invalid_systemPrompt/,
      );
    });

    it("should throw ValidationError when version is not a positive integer", () => {
      assert.throws(
        () =>
          createPromptBundle({
            name: "test-bundle",
            version: -1,
            displayVersion: "1.0.0",
            domain: "test-domain",
            taskType: "general",
            systemPrompt: validSegment,
            compatibilityMatrix: validCompatibilityMatrix,
          }),
        /prompt_bundle.invalid_version/,
      );
    });

    it("should throw ValidationError when domain is empty", () => {
      assert.throws(
        () =>
          createPromptBundle({
            name: "test-bundle",
            version: 1,
            displayVersion: "1.0.0",
            domain: "",
            taskType: "general",
            systemPrompt: validSegment,
            compatibilityMatrix: validCompatibilityMatrix,
          }),
        /prompt_bundle.invalid_domain/,
      );
    });

    it("should throw ValidationError when traffic weight is out of range", () => {
      assert.throws(
        () =>
          createPromptBundle({
            name: "test-bundle",
            version: 1,
            displayVersion: "1.0.0",
            domain: "test-domain",
            taskType: "general",
            systemPrompt: validSegment,
            compatibilityMatrix: validCompatibilityMatrix,
            metadata: {
              owner: "test",
              deprecated: false,
              lifecycleStatus: "active",
              tags: [],
              compatibilityTags: [],
              trafficAllocation: { weight: 150 },
            },
          }),
        /prompt_bundle.invalid_traffic_weight/,
      );
    });

    it("should throw ValidationError when deprecated=true but lifecycleStatus=active", () => {
      assert.throws(
        () =>
          createPromptBundle({
            name: "test-bundle",
            version: 1,
            displayVersion: "1.0.0",
            domain: "test-domain",
            taskType: "general",
            systemPrompt: validSegment,
            compatibilityMatrix: validCompatibilityMatrix,
            metadata: {
              owner: "test",
              deprecated: true,
              lifecycleStatus: "active",
              tags: [],
              compatibilityTags: [],
              trafficAllocation: { weight: 100 },
            },
          }),
        /prompt_bundle.invalid_lifecycle_status/,
      );
    });
  });

  describe("validatePromptBundleRegistrationInput", () => {
    it("should return input when valid", () => {
      const input = {
        name: "test-bundle",
        version: 1,
        displayVersion: "1.0.0",
        domain: "test-domain",
        taskType: "general",
        systemPrompt: validSegment,
        compatibilityMatrix: validCompatibilityMatrix,
      };
      const result = validatePromptBundleRegistrationInput(input);
      assert.strictEqual(result.name, "test-bundle");
    });

    it("should throw ValidationError when displayVersion is empty", () => {
      assert.throws(
        () =>
          validatePromptBundleRegistrationInput({
            name: "test-bundle",
            version: 1,
            displayVersion: "",
            domain: "test-domain",
            taskType: "general",
            systemPrompt: validSegment,
            compatibilityMatrix: validCompatibilityMatrix,
          }),
        /prompt_bundle.invalid_display_version/,
      );
    });

    it("should throw ValidationError when taskType is empty", () => {
      assert.throws(
        () =>
          validatePromptBundleRegistrationInput({
            name: "test-bundle",
            version: 1,
            displayVersion: "1.0.0",
            domain: "test-domain",
            taskType: "",
            systemPrompt: validSegment,
            compatibilityMatrix: validCompatibilityMatrix,
          }),
        /prompt_bundle.invalid_task_type/,
      );
    });

    it("should validate userPrompt when provided", () => {
      assert.throws(
        () =>
          validatePromptBundleRegistrationInput({
            name: "test-bundle",
            version: 1,
            displayVersion: "1.0.0",
            domain: "test-domain",
            taskType: "general",
            systemPrompt: validSegment,
            userPrompt: { content: "", templateVariables: [], channel: "user" },
            compatibilityMatrix: validCompatibilityMatrix,
          }),
        /prompt_bundle.invalid_userPrompt/,
      );
    });
  });

  describe("validatePromptBundle", () => {
    it("should return bundle when valid", () => {
      const bundle = createPromptBundle({
        name: "test-bundle",
        version: 1,
        displayVersion: "1.0.0",
        domain: "test-domain",
        taskType: "general",
        systemPrompt: validSegment,
        compatibilityMatrix: validCompatibilityMatrix,
      });
      const result = validatePromptBundle(bundle);
      assert.strictEqual(result.bundleId, bundle.bundleId);
    });

    it("should throw ValidationError when bundleId is empty", () => {
      const bundle = createPromptBundle({
        name: "test-bundle",
        version: 1,
        displayVersion: "1.0.0",
        domain: "test-domain",
        taskType: "general",
        systemPrompt: validSegment,
        compatibilityMatrix: validCompatibilityMatrix,
      });
      // Manually create invalid bundle with empty bundleId
      (bundle as PromptBundle).bundleId = "";
      assert.throws(
        () => validatePromptBundle(bundle),
        /prompt_bundle.invalid_bundle_id/,
      );
    });
  });

  describe("PromptBundleTrafficAllocation", () => {
    it("should accept valid traffic allocation", () => {
      const allocation: PromptBundleTrafficAllocation = {
        weight: 75,
        startTime: "2024-01-01T00:00:00Z",
        endTime: "2024-12-31T23:59:59Z",
        targeting: {
          tenantIds: ["tenant-1", "tenant-2"],
          userSegments: ["pro"],
          regions: ["us-east"],
          modelTiers: ["standard"],
        },
      };
      assert.strictEqual(allocation.weight, 75);
      assert.deepStrictEqual(allocation.targeting?.tenantIds, ["tenant-1", "tenant-2"]);
    });
  });

  describe("PromptLifecycleStatus", () => {
    it("should have correct values", () => {
      const statuses: PromptLifecycleStatus[] = ["draft", "active", "deprecated", "archived"];
      assert.deepStrictEqual(statuses, ["draft", "active", "deprecated", "archived"]);
    });
  });
});