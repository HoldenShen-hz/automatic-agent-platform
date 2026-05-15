import test from "node:test";
import assert from "node:assert/strict";

import {
  DualChannelStepOutputSchema,
  parseDualChannelStepOutput,
} from "../../../../../../src/platform/five-plane-orchestration/oapeflir/types/dual-channel-step-output.js";

test("DualChannelStepOutputSchema parses valid output", () => {
  const validOutput = {
    stepId: "step_001",
    planRef: "plan_123",
    userFacingResult: {
      summary: "Task completed successfully",
      artifacts: ["artifact:1", "artifact:2"],
    },
    systemTelemetry: {
      durationMs: 1500,
      tokensUsed: 3500,
      modelId: "claude-opus-4-6",
      retryCount: 0,
      validationPassed: true,
    },
  };

  const result = DualChannelStepOutputSchema.parse(validOutput);
  assert.equal(result.stepId, "step_001");
  assert.equal(result.planRef, "plan_123");
  assert.equal(result.userFacingResult.summary, "Task completed successfully");
  assert.deepEqual(result.userFacingResult.artifacts, ["artifact:1", "artifact:2"]);
  assert.equal(result.systemTelemetry.durationMs, 1500);
  assert.equal(result.systemTelemetry.tokensUsed, 3500);
  assert.equal(result.systemTelemetry.modelId, "claude-opus-4-6");
  assert.equal(result.systemTelemetry.retryCount, 0);
  assert.equal(result.systemTelemetry.validationPassed, true);
});

test("DualChannelStepOutputSchema applies defaults for artifacts", () => {
  const minimalOutput = {
    stepId: "step_min",
    planRef: "plan_min",
    userFacingResult: {
      summary: "Minimal output",
    },
    systemTelemetry: {
      durationMs: 100,
      tokensUsed: 50,
      modelId: "test-model",
      retryCount: 0,
      validationPassed: false,
    },
  };

  const result = DualChannelStepOutputSchema.parse(minimalOutput);
  assert.deepEqual(result.userFacingResult.artifacts, []);
});

test("DualChannelStepOutputSchema rejects missing stepId", () => {
  assert.throws(() => {
    DualChannelStepOutputSchema.parse({
      stepId: "",
      planRef: "plan_123",
      userFacingResult: {
        summary: "Test",
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: 100,
        tokensUsed: 50,
        modelId: "m",
        retryCount: 0,
        validationPassed: true,
      },
    });
  });
});

test("DualChannelStepOutputSchema rejects missing planRef", () => {
  assert.throws(() => {
    DualChannelStepOutputSchema.parse({
      stepId: "step_1",
      planRef: "",
      userFacingResult: {
        summary: "Test",
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: 100,
        tokensUsed: 50,
        modelId: "m",
        retryCount: 0,
        validationPassed: true,
      },
    });
  });
});

test("DualChannelStepOutputSchema rejects empty summary", () => {
  assert.throws(() => {
    DualChannelStepOutputSchema.parse({
      stepId: "step_1",
      planRef: "plan_1",
      userFacingResult: {
        summary: "",
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: 100,
        tokensUsed: 50,
        modelId: "m",
        retryCount: 0,
        validationPassed: true,
      },
    });
  });
});

test("DualChannelStepOutputSchema rejects negative durationMs", () => {
  assert.throws(() => {
    DualChannelStepOutputSchema.parse({
      stepId: "step_1",
      planRef: "plan_1",
      userFacingResult: {
        summary: "Test",
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: -100,
        tokensUsed: 50,
        modelId: "m",
        retryCount: 0,
        validationPassed: true,
      },
    });
  });
});

test("DualChannelStepOutputSchema rejects negative tokensUsed", () => {
  assert.throws(() => {
    DualChannelStepOutputSchema.parse({
      stepId: "step_1",
      planRef: "plan_1",
      userFacingResult: {
        summary: "Test",
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: 100,
        tokensUsed: -50,
        modelId: "m",
        retryCount: 0,
        validationPassed: true,
      },
    });
  });
});

test("DualChannelStepOutputSchema rejects negative retryCount", () => {
  assert.throws(() => {
    DualChannelStepOutputSchema.parse({
      stepId: "step_1",
      planRef: "plan_1",
      userFacingResult: {
        summary: "Test",
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: 100,
        tokensUsed: 50,
        modelId: "m",
        retryCount: -1,
        validationPassed: true,
      },
    });
  });
});

test("DualChannelStepOutputSchema rejects missing required fields", () => {
  assert.throws(() => {
    DualChannelStepOutputSchema.parse({
      stepId: "step_partial",
    });
  });
});

test("DualChannelStepOutputSchema rejects missing systemTelemetry", () => {
  assert.throws(() => {
    DualChannelStepOutputSchema.parse({
      stepId: "step_1",
      planRef: "plan_1",
      userFacingResult: {
        summary: "Test",
      },
    });
  });
});

test("parseDualChannelStepOutput returns parsed DualChannelStepOutput", () => {
  const input = {
    stepId: "step_parse_1",
    planRef: "plan_parse",
    userFacingResult: {
      summary: "Parsed output summary",
      artifacts: ["artifact:parsed_1"],
    },
    systemTelemetry: {
      durationMs: 2500,
      tokensUsed: 5000,
      modelId: "claude-sonnet-4-7",
      retryCount: 2,
      validationPassed: true,
    },
  };

  const result = parseDualChannelStepOutput(input);
  assert.equal(result.stepId, "step_parse_1");
  assert.equal(result.planRef, "plan_parse");
  assert.equal(result.userFacingResult.summary, "Parsed output summary");
  assert.equal(result.systemTelemetry.durationMs, 2500);
  assert.equal(result.systemTelemetry.tokensUsed, 5000);
  assert.equal(result.systemTelemetry.modelId, "claude-sonnet-4-7");
  assert.equal(result.systemTelemetry.retryCount, 2);
  assert.equal(result.systemTelemetry.validationPassed, true);
});

test("parseDualChannelStepOutput throws on invalid input", () => {
  assert.throws(() => {
    parseDualChannelStepOutput({
      stepId: "",
      planRef: "",
      userFacingResult: {
        summary: "",
      },
      systemTelemetry: {
        durationMs: -1,
        tokensUsed: -1,
        modelId: "",
        retryCount: -1,
        validationPassed: true,
      },
    });
  });
});

test("DualChannelStepOutputSchema handles output with many artifacts", () => {
  const manyArtifacts = {
    stepId: "step_many",
    planRef: "plan_many",
    userFacingResult: {
      summary: "Multiple artifacts produced",
      artifacts: [
        "artifact:a1",
        "artifact:a2",
        "artifact:a3",
        "artifact:a4",
        "artifact:a5",
      ],
    },
    systemTelemetry: {
      durationMs: 5000,
      tokensUsed: 15000,
      modelId: "claude-opus-4-6",
      retryCount: 1,
      validationPassed: true,
    },
  };

  const result = DualChannelStepOutputSchema.parse(manyArtifacts);
  assert.equal(result.userFacingResult.artifacts.length, 5);
});

test("DualChannelStepOutputSchema handles output with zero duration", () => {
  const zeroDuration = {
    stepId: "step_zero",
    planRef: "plan_zero",
    userFacingResult: {
      summary: "Immediate completion",
      artifacts: [],
    },
    systemTelemetry: {
      durationMs: 0,
      tokensUsed: 10,
      modelId: "fast-model",
      retryCount: 0,
      validationPassed: true,
    },
  };

  const result = DualChannelStepOutputSchema.parse(zeroDuration);
  assert.equal(result.systemTelemetry.durationMs, 0);
});
