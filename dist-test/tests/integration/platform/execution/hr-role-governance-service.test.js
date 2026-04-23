import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { ApprovalService } from "../../../../src/platform/control-plane/approval-center/approval-service.js";
import { HrRoleGovernanceService } from "../../../../src/org-governance/org-model/hr-role-governance-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { RoleToolExposureService } from "../../../../src/platform/execution/tool-executor/role-tool-exposure-service.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";
function createRegistry() {
    return {
        divisions: new Map([
            ["content_ops", {
                    id: "content_ops",
                    version: "1",
                    name: "Content Ops",
                    description: "Content workflows",
                    priority: 20,
                    triggers: ["content"],
                    defaultWorkflowId: "content_default",
                    orchestrationWorkflowId: null,
                    roles: [
                        {
                            id: "script_writer",
                            name: "Script Writer",
                            promptPath: "/tmp/content_ops/roles/script_writer.prompt.md",
                            promptText: "Write scripts and outlines.",
                            model: "balanced",
                            tools: ["read"],
                            maxInstances: 2,
                        },
                        {
                            id: "brief_reviewer",
                            name: "Brief Reviewer",
                            promptPath: "/tmp/content_ops/roles/brief_reviewer.prompt.md",
                            promptText: "Review content briefs and ask clarifying questions.",
                            model: "balanced",
                            tools: ["read", "question"],
                            maxInstances: 2,
                        },
                    ],
                    workflows: [],
                    rootPath: "/tmp/content_ops",
                }],
        ]),
        workflows: new Map(),
    };
}
function createProposal() {
    return {
        divisionId: "content_ops",
        roleId: "voiceover_brief_writer",
        name: "Voiceover Brief Writer",
        promptText: "Write voiceover briefs for already approved scripts and ask for missing style details.",
        model: "balanced",
        tools: ["read", "question"],
        maxInstances: 1,
        scope: {
            responsibilities: [
                "prepare voiceover briefs from finalized scripts",
                "ask operators for missing style constraints",
            ],
            boundaries: [
                "Only read approved script context and ask clarifying questions.",
                "Do not generate audio or modify the approved script.",
            ],
        },
        inputSchema: {
            required: ["script_text", "voice_style"],
            optional: ["language"],
        },
        outputSchema: {
            required: ["voiceover_brief"],
            optional: ["open_questions"],
        },
        preconditions: [
            {
                check: "script_text_present",
                description: "An approved script must exist before creating a brief.",
            },
        ],
        workflowSuggestion: null,
    };
}
test("HrRoleGovernanceService submits role proposals for approval and exposes approved roles to runtime services", () => {
    const workspace = createTempWorkspace("aa-hr-role-");
    const dbPath = join(workspace, "hr-role.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const approvalService = new ApprovalService(db, store);
        seedTaskAndExecution(db, store, { taskId: "task-hr-1", executionId: "exec-hr-1" });
        const governance = new HrRoleGovernanceService(createRegistry(), approvalService);
        const submission = governance.submitProposal({
            gapAnalysisRequest: {
                taskId: "task-hr-1",
                taskDescription: "Read the finalized script, ask for missing tone details, and prepare a voiceover brief.",
                targetDivisionId: "content_ops",
                triggerReason: "scope_exceeded",
                requestedCapabilities: ["voiceover brief", "tone clarification"],
            },
            proposal: createProposal(),
            executionId: "exec-hr-1",
            sessionId: "session-hr-1",
        });
        assert.equal(submission.validation.valid, true);
        assert.ok(submission.approvalRequest != null);
        assert.equal(submission.approvalRequest?.reason, "hr.role_creation:content_ops:voiceover_brief_writer");
        const approvals = store.listApprovalsByTask("task-hr-1");
        const events = store.listEventsForTask("task-hr-1");
        assert.equal(approvals.length, 1);
        assert.equal(approvals[0]?.status, "requested");
        assert.equal(events.some((event) => event.eventType === "decision:requested"), true);
        assert.match(approvals[0]?.requestJson ?? "", /voiceover_brief_writer/);
        const runtimeRegistry = governance.registerApprovedRole({
            proposal: createProposal(),
            approvalStatus: "approved",
        });
        const exposure = new RoleToolExposureService(runtimeRegistry).resolve({
            divisionId: "content_ops",
            roleId: "voiceover_brief_writer",
            taskContext: "Read the script and ask a clarifying question about tone.",
        });
        assert.deepEqual(exposure.resolvedToolNames, ["read", "question"]);
        assert.deepEqual(exposure.visibleToolNames, ["read", "question"]);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=hr-role-governance-service.test.js.map