import assert from "node:assert/strict";
import test from "node:test";
// =============================================================================
// PromptBundleSegment Tests
// =============================================================================
test("PromptBundleSegment with all fields", () => {
    const segment = {
        content: "You are a helpful assistant.",
        templateVariables: ["userName", "taskType"],
        channel: "system",
    };
    assert.equal(segment.content, "You are a helpful assistant.");
    assert.deepEqual(segment.templateVariables, ["userName", "taskType"]);
    assert.equal(segment.channel, "system");
});
test("PromptBundleSegment accepts all channel values", () => {
    const channels = ["system", "developer", "user"];
    for (const channel of channels) {
        const segment = {
            content: "test",
            templateVariables: [],
            channel,
        };
        assert.equal(segment.channel, channel);
    }
});
test("PromptBundleSegment with empty templateVariables", () => {
    const segment = {
        content: "Static prompt",
        templateVariables: [],
        channel: "user",
    };
    assert.deepEqual(segment.templateVariables, []);
});
// =============================================================================
// FewShotExample Tests
// =============================================================================
test("FewShotExample with required fields", () => {
    const example = {
        exampleId: "example-1",
        input: "What is 2+2?",
        output: "4",
        explanation: undefined,
        tags: [],
    };
    assert.equal(example.exampleId, "example-1");
    assert.equal(example.input, "What is 2+2?");
    assert.equal(example.output, "4");
    assert.equal(example.explanation, undefined);
    assert.deepEqual(example.tags, []);
});
test("FewShotExample with all fields", () => {
    const example = {
        exampleId: "example-2",
        input: "Translate to French: hello",
        output: "bonjour",
        explanation: "Basic greeting translation",
        tags: ["translation", "beginner"],
    };
    assert.equal(example.explanation, "Basic greeting translation");
    assert.deepEqual(example.tags, ["translation", "beginner"]);
});
// =============================================================================
// PromptBundleConstraints Tests
// =============================================================================
test("PromptBundleConstraints with undefined optional fields", () => {
    const constraints = {
        maxTokens: undefined,
        temperature: undefined,
        topP: undefined,
        stopSequences: undefined,
        responseFormat: undefined,
        customConstraints: {},
    };
    assert.equal(constraints.maxTokens, undefined);
    assert.equal(constraints.temperature, undefined);
    assert.deepEqual(constraints.customConstraints, {});
});
test("PromptBundleConstraints with all values set", () => {
    const constraints = {
        maxTokens: 4096,
        temperature: 0.7,
        topP: 0.9,
        stopSequences: ["END", "STOP"],
        responseFormat: "json",
        customConstraints: { topK: 40 },
    };
    assert.equal(constraints.maxTokens, 4096);
    assert.equal(constraints.temperature, 0.7);
    assert.equal(constraints.topP, 0.9);
    assert.deepEqual(constraints.stopSequences, ["END", "STOP"]);
    assert.equal(constraints.responseFormat, "json");
    assert.equal(constraints.customConstraints.topK, 40);
});
test("PromptBundleConstraints accepts all responseFormat values", () => {
    const formats = [
        "text",
        "json",
        "xml",
        "markdown",
        undefined,
    ];
    for (const format of formats) {
        const constraints = {
            maxTokens: 1000,
            temperature: 0.5,
            topP: 1.0,
            stopSequences: undefined,
            responseFormat: format,
            customConstraints: {},
        };
        assert.equal(constraints.responseFormat, format);
    }
});
// =============================================================================
// TrafficTargeting Tests
// =============================================================================
test("TrafficTargeting with all undefined fields", () => {
    const targeting = {
        tenantIds: undefined,
        userSegments: undefined,
        regions: undefined,
        modelTiers: undefined,
    };
    assert.equal(targeting.tenantIds, undefined);
    assert.equal(targeting.userSegments, undefined);
});
test("TrafficTargeting with specific targeting criteria", () => {
    const targeting = {
        tenantIds: ["tenant-a", "tenant-b"],
        userSegments: ["premium", "enterprise"],
        regions: ["us-east-1", "eu-west-1"],
        modelTiers: ["standard", "premium"],
    };
    assert.deepEqual(targeting.tenantIds, ["tenant-a", "tenant-b"]);
    assert.deepEqual(targeting.userSegments, ["premium", "enterprise"]);
    assert.deepEqual(targeting.regions, ["us-east-1", "eu-west-1"]);
    assert.deepEqual(targeting.modelTiers, ["standard", "premium"]);
});
// =============================================================================
// PromptBundleTrafficAllocation Tests
// =============================================================================
test("PromptBundleTrafficAllocation with required fields only", () => {
    const allocation = {
        weight: 100,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
    };
    assert.equal(allocation.weight, 100);
    assert.equal(allocation.startTime, undefined);
    assert.equal(allocation.endTime, undefined);
    assert.equal(allocation.targeting, undefined);
});
test("PromptBundleTrafficAllocation with all fields", () => {
    const targeting = {
        tenantIds: ["t1"],
        userSegments: undefined,
        regions: undefined,
        modelTiers: undefined,
    };
    const allocation = {
        weight: 50,
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: "2026-12-31T23:59:59.000Z",
        targeting,
    };
    assert.equal(allocation.weight, 50);
    assert.equal(allocation.startTime, "2026-01-01T00:00:00.000Z");
    assert.equal(allocation.endTime, "2026-12-31T23:59:59.000Z");
    assert.deepEqual(allocation.targeting, targeting);
});
test("PromptBundleTrafficAllocation weight bounds", () => {
    const lowWeight = { weight: 0, startTime: undefined, endTime: undefined, targeting: undefined };
    assert.equal(lowWeight.weight, 0);
    const highWeight = { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined };
    assert.equal(highWeight.weight, 100);
});
// =============================================================================
// PromptBundleMetadata Tests
// =============================================================================
test("PromptBundleMetadata with required fields", () => {
    const metadata = {
        owner: "platform-team",
        deprecated: false,
        tags: ["v1", "stable"],
        compatibilityTags: ["core", "standard"],
        trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
    };
    assert.equal(metadata.owner, "platform-team");
    assert.equal(metadata.deprecated, false);
    assert.deepEqual(metadata.tags, ["v1", "stable"]);
    assert.deepEqual(metadata.compatibilityTags, ["core", "standard"]);
});
test("PromptBundleMetadata with deprecated flag", () => {
    const metadata = {
        owner: "legacy-team",
        deprecated: true,
        tags: ["v0", "deprecated"],
        compatibilityTags: [],
        trafficAllocation: { weight: 0, startTime: undefined, endTime: undefined, targeting: undefined },
    };
    assert.equal(metadata.deprecated, true);
});
// =============================================================================
// PromptBundle Tests
// =============================================================================
test("PromptBundle with all fields", () => {
    const bundle = {
        bundleId: "bundle-123",
        name: "Assistant Prompt",
        version: "1.0.0",
        domain: "assistant",
        taskType: "chat",
        packId: "pack-456",
        systemPrompt: {
            content: "You are a helpful assistant.",
            templateVariables: ["userName"],
            channel: "system",
        },
        userPrompt: {
            content: "Help the user with: {{task}}",
            templateVariables: ["task"],
            channel: "user",
        },
        fewShotExamples: [
            {
                exampleId: "ex-1",
                input: "Hello",
                output: "Hi there!",
                explanation: undefined,
                tags: [],
            },
        ],
        constraints: {
            maxTokens: 2048,
            temperature: 0.7,
            topP: undefined,
            stopSequences: undefined,
            responseFormat: "text",
            customConstraints: {},
        },
        metadata: {
            owner: "team-a",
            deprecated: false,
            tags: ["v1"],
            compatibilityTags: ["standard"],
            trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-15T00:00:00.000Z",
    };
    assert.equal(bundle.bundleId, "bundle-123");
    assert.equal(bundle.name, "Assistant Prompt");
    assert.equal(bundle.version, "1.0.0");
    assert.equal(bundle.domain, "assistant");
    assert.equal(bundle.taskType, "chat");
    assert.equal(bundle.packId, "pack-456");
    assert.equal(bundle.systemPrompt.content, "You are a helpful assistant.");
    assert.equal(bundle.userPrompt?.content, "Help the user with: {{task}}");
    assert.equal(bundle.fewShotExamples.length, 1);
    assert.equal(bundle.constraints.maxTokens, 2048);
    assert.equal(bundle.metadata.owner, "team-a");
});
test("PromptBundle with undefined optional fields", () => {
    const bundle = {
        bundleId: "bundle-789",
        name: "Minimal Prompt",
        version: "1.0.0",
        domain: "test",
        taskType: "simple",
        packId: undefined,
        systemPrompt: { content: "Hello", templateVariables: [], channel: "system" },
        userPrompt: undefined,
        fewShotExamples: [],
        constraints: {
            maxTokens: undefined,
            temperature: undefined,
            topP: undefined,
            stopSequences: undefined,
            responseFormat: undefined,
            customConstraints: {},
        },
        metadata: {
            owner: "tester",
            deprecated: false,
            tags: [],
            compatibilityTags: [],
            trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
    assert.equal(bundle.packId, undefined);
    assert.equal(bundle.userPrompt, undefined);
    assert.deepEqual(bundle.fewShotExamples, []);
    assert.equal(bundle.constraints.maxTokens, undefined);
});
// =============================================================================
// PromptBundleRegistrationInput Tests
// =============================================================================
test("PromptBundleRegistrationInput with minimal fields", () => {
    const input = {
        name: "New Bundle",
        version: "1.0.0",
        domain: "test",
        taskType: "generic",
        packId: undefined,
        systemPrompt: { content: "Test", templateVariables: [], channel: "system" },
        userPrompt: undefined,
        fewShotExamples: undefined,
        constraints: undefined,
        metadata: undefined,
    };
    assert.equal(input.name, "New Bundle");
    assert.equal(input.fewShotExamples, undefined);
    assert.equal(input.constraints, undefined);
    assert.equal(input.metadata, undefined);
});
test("PromptBundleRegistrationInput with all optional fields", () => {
    const systemPrompt = { content: "Sys", templateVariables: [], channel: "system" };
    const userPrompt = { content: "User", templateVariables: [], channel: "user" };
    const constraints = {
        maxTokens: 1000,
        temperature: 0.5,
        topP: undefined,
        stopSequences: undefined,
        responseFormat: undefined,
        customConstraints: {},
    };
    const metadata = {
        owner: "owner1",
        deprecated: false,
        tags: ["new"],
        compatibilityTags: [],
        trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
    };
    const input = {
        name: "Full Bundle",
        version: "2.0.0",
        domain: "production",
        taskType: "advanced",
        packId: "pack-1",
        systemPrompt,
        userPrompt,
        fewShotExamples: [],
        constraints,
        metadata,
    };
    assert.equal(input.packId, "pack-1");
    assert.deepEqual(input.fewShotExamples, []);
    assert.equal(input.constraints?.maxTokens, 1000);
    assert.equal(input.metadata?.owner, "owner1");
});
// =============================================================================
// PromptBundleVersion Tests
// =============================================================================
test("PromptBundleVersion with all fields", () => {
    const version = {
        version: "2.0.0",
        isCurrent: true,
        isDefault: false,
        trafficWeight: 75,
        createdAt: "2026-01-15T00:00:00.000Z",
        deprecated: false,
    };
    assert.equal(version.version, "2.0.0");
    assert.equal(version.isCurrent, true);
    assert.equal(version.isDefault, false);
    assert.equal(version.trafficWeight, 75);
    assert.equal(version.createdAt, "2026-01-15T00:00:00.000Z");
    assert.equal(version.deprecated, false);
});
test("PromptBundleVersion with deprecated flag", () => {
    const version = {
        version: "0.9.0",
        isCurrent: false,
        isDefault: false,
        trafficWeight: 0,
        createdAt: "2025-01-01T00:00:00.000Z",
        deprecated: true,
    };
    assert.equal(version.deprecated, true);
    assert.equal(version.trafficWeight, 0);
});
// =============================================================================
// PromptBundleListResult Tests
// =============================================================================
test("PromptBundleListResult structure", () => {
    const bundle = {
        bundleId: "bundle-list-test",
        name: "List Test Bundle",
        version: "1.0.0",
        domain: "test",
        taskType: "simple",
        packId: undefined,
        systemPrompt: { content: "Test", templateVariables: [], channel: "system" },
        userPrompt: undefined,
        fewShotExamples: [],
        constraints: {
            maxTokens: undefined,
            temperature: undefined,
            topP: undefined,
            stopSequences: undefined,
            responseFormat: undefined,
            customConstraints: {},
        },
        metadata: {
            owner: "test",
            deprecated: false,
            tags: [],
            compatibilityTags: [],
            trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const versions = [
        {
            version: "1.0.0",
            isCurrent: true,
            isDefault: true,
            trafficWeight: 100,
            createdAt: "2026-01-01T00:00:00.000Z",
            deprecated: false,
        },
        {
            version: "0.9.0",
            isCurrent: false,
            isDefault: false,
            trafficWeight: 0,
            createdAt: "2025-12-01T00:00:00.000Z",
            deprecated: true,
        },
    ];
    const result = {
        bundle,
        availableVersions: versions,
        currentVersion: "1.0.0",
    };
    assert.equal(result.bundle.bundleId, "bundle-list-test");
    assert.equal(result.availableVersions.length, 2);
    assert.equal(result.currentVersion, "1.0.0");
    assert.equal(result.availableVersions[0]?.isCurrent, true);
});
// =============================================================================
// Edge Cases
// =============================================================================
test("PromptBundleConstraints customConstraints can hold arbitrary data", () => {
    const customConstraints = {
        topK: 50,
        presencePenalty: 0.5,
        frequencyPenalty: 0.3,
        nested: { deep: "value" },
    };
    const constraints = {
        maxTokens: 500,
        temperature: 0.9,
        topP: undefined,
        stopSequences: undefined,
        responseFormat: undefined,
        customConstraints,
    };
    assert.equal(constraints.customConstraints.topK, 50);
    // Access nested through type assertion since customConstraints is Record<string, unknown>
    const nested = constraints.customConstraints.nested;
    assert.equal(nested.deep, "value");
});
test("TrafficTargeting allows empty arrays", () => {
    const targeting = {
        tenantIds: [],
        userSegments: [],
        regions: [],
        modelTiers: [],
    };
    assert.deepEqual(targeting.tenantIds, []);
    assert.deepEqual(targeting.userSegments, []);
});
test("PromptBundleMetadata allows duplicate tags", () => {
    const metadata = {
        owner: "team",
        deprecated: false,
        tags: ["a", "a", "b"],
        compatibilityTags: [],
        trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
    };
    assert.deepEqual(metadata.tags, ["a", "a", "b"]);
});
test("PromptBundle version semantic versioning", () => {
    const versions = ["0.0.1", "1.0.0", "2.10.100", "10.0.0-beta"];
    for (const version of versions) {
        const bundle = {
            bundleId: `bundle-${version}`,
            name: "Test",
            version,
            domain: "test",
            taskType: "simple",
            packId: undefined,
            systemPrompt: { content: "T", templateVariables: [], channel: "system" },
            userPrompt: undefined,
            fewShotExamples: [],
            constraints: {
                maxTokens: undefined,
                temperature: undefined,
                topP: undefined,
                stopSequences: undefined,
                responseFormat: undefined,
                customConstraints: {},
            },
            metadata: {
                owner: "t",
                deprecated: false,
                tags: [],
                compatibilityTags: [],
                trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
            },
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        };
        assert.equal(bundle.version, version);
    }
});
//# sourceMappingURL=index.test.js.map