import test from "node:test";
import assert from "node:assert/strict";

import { AssessmentService } from "../../../../../src/platform/orchestration/oapeflir/assessment-service.js";

test("AssessmentService derives critical risk and approval constraint from critical signals", () => {
  const service = new AssessmentService();
  const assessment = service.assess({
    taskId: "task_1",
    timestamp: Date.now(),
    objective: "repair deployment issue",
    currentPhase: "planning",
    userIntent: {
      raw: "repair deployment issue",
      normalized: "repair deployment issue",
      confidence: 0.9,
    },
    blockers: [
      {
        description: "tenant boundary risk",
        severity: "critical",
      },
    ],
    codebaseSnapshot: {
      rootPath: process.cwd(),
      fileCount: 3,
      relevantFiles: [{ path: "src/app.ts" }],
    },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      availableTools: ["read", "apply_patch"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: ["src/app.ts"],
    metrics: { approvalPending: 1 },
  });

  assert.equal(assessment.risk, "critical");
  assert.equal(assessment.approvalPolicy.required, true);
  assert.equal(assessment.approvalPolicy.level, "admin");
  assert.ok(assessment.riskAssessment.factors.includes("critical_blocker"));
});

test("AssessmentService returns low risk for simple tasks with no blockers", () => {
  const service = new AssessmentService();
  const assessment = service.assess({
    taskId: "task_2",
    timestamp: Date.now(),
    objective: "read a file",
    currentPhase: "executing",
    userIntent: {
      raw: "show me the file",
      normalized: "show me the file",
      confidence: 0.95,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: process.cwd(),
      fileCount: 1,
      relevantFiles: [{ path: "README.md" }],
    },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      availableTools: ["read"],
    },
    historicalContext: {
      previousTaskIds: ["task_1"],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: ["README.md"],
    metrics: { approvalPending: 0 },
  });

  assert.equal(assessment.risk, "low");
  assert.equal(assessment.approvalPolicy.required, false);
  assert.equal(assessment.approvalPolicy.level, "none");
});

test("AssessmentService returns high risk for tasks with high blockers", () => {
  const service = new AssessmentService();
  const assessment = service.assess({
    taskId: "task_3",
    timestamp: Date.now(),
    objective: "modify config",
    currentPhase: "planning",
    userIntent: {
      raw: "update settings",
      normalized: "update settings",
      confidence: 0.7,
    },
    blockers: [
      {
        description: "potential side effect",
        severity: "high",
      },
    ],
    codebaseSnapshot: {
      rootPath: process.cwd(),
      fileCount: 5,
      relevantFiles: [{ path: "config/app.json" }],
    },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      availableTools: ["read", "write"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: ["config/app.json"],
    metrics: { approvalPending: 0 },
  });

  assert.equal(assessment.risk, "high");
  assert.equal(assessment.approvalPolicy.required, true);
});

test("AssessmentService handles high approval pending metric", () => {
  const service = new AssessmentService();
  const assessment = service.assess({
    taskId: "task_4",
    timestamp: Date.now(),
    objective: "batch operation",
    currentPhase: "planning",
    userIntent: {
      raw: "process queue",
      normalized: "process queue",
      confidence: 0.8,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: process.cwd(),
      fileCount: 10,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      availableTools: ["read", "write", "delete"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: { approvalPending: 5 },
  });

  assert.equal(assessment.approvalPolicy.required, true);
  assert.ok(assessment.approvalPolicy.level === "admin" || assessment.approvalPolicy.level === "user");
});
