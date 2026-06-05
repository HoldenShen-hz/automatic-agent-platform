import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { NlEntryService } from "../../../interaction/nl-gateway/index.js";
import { GoalDecompositionService, type Goal } from "../../../interaction/goal-decomposer/index.js";
import { UnifiedChatPlanGenerator } from "../../../interaction/goal-decomposer/llm-plan-generator.js";
import { createUnifiedChatProvider, type UnifiedChatProvider } from "../../model-gateway/provider-registry/unified-chat-provider.js";

const REAL_TASK_EXECUTION_MAX_ATTEMPTS = 3;
const RETRYABLE_REAL_TASK_ERROR_PATTERN =
  /MiniMax API error:\s*(?:429|500|502|503|504|520|529)|MiniMax API business error:\s*1000\s*-\s*unknown error,\s*520|overloaded_error|当前服务集群负载较高|provider\.request_timeout/iu;

export interface RealTaskExecutionServiceOptions {
  readonly reportRoot: string;
  readonly model?: string;
  readonly provider?: UnifiedChatProvider;
}

export interface RealTaskExecutionRequest {
  readonly taskId: string;
  readonly title: string;
  readonly divisionId?: string | null;
  readonly requestedBy?: string;
}

interface GeneratedTaskReport {
  readonly outputSummary: string;
  readonly reportPath: string;
  readonly reportJsonPath: string;
  readonly planTaskCount: number;
  readonly markdown: string;
  readonly reportJson: string;
}

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildDefaultProvider(): UnifiedChatProvider {
  const apiKey = normalizeOptionalEnv(process.env.MINIMAX_API_KEY) ?? normalizeOptionalEnv(process.env.AA_MINIMAX_API_KEY);
  if (apiKey == null) {
    throw new Error("real_task_execution.minimax_api_key_missing");
  }
  const baseUrl = normalizeOptionalEnv(process.env.MINIMAX_API_BASE);
  return createUnifiedChatProvider({
    minimax: {
      apiKey,
      ...(baseUrl == null ? {} : { baseUrl }),
    },
  });
}

function buildGoal(input: RealTaskExecutionRequest): Goal {
  return {
    goalId: input.taskId,
    description: input.title,
    owner: input.requestedBy ?? "local-dev-operator",
    successCriteria: [
      {
        metric: "report_delivery",
        target: "deliver actionable research report",
        evaluationMethod: "human_review",
      },
    ],
    constraints: [
      "return concise Chinese markdown",
      "focus on code productivity improvements with execution guidance",
    ],
    priority: "normal",
  };
}

function summarizeMarkdown(markdown: string): string {
  return markdown
    .replace(/^#+\s*/gmu, "")
    .replace(/[*`>_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function slugifyTaskTitle(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug.length > 0 ? slug : "task";
}

async function sleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function buildRealTaskTraceId(taskId: string): string {
  return `real-task:${taskId}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class RealTaskExecutionService {
  private readonly provider: UnifiedChatProvider;
  private readonly model: string;

  public constructor(
    private readonly store: AuthoritativeTaskStore,
    private readonly options: RealTaskExecutionServiceOptions,
  ) {
    this.provider = options.provider ?? buildDefaultProvider();
    this.model = options.model ?? "minimax-m2.7";
  }

  public executeTask(input: RealTaskExecutionRequest): void {
    void this.runTask(input);
  }

  private async runTask(input: RealTaskExecutionRequest): Promise<void> {
    const startedAt = nowIso();
    this.store.task.updateTaskStatus(input.taskId, "in_progress", startedAt, null, null);
    this.ensureWorkflowState(input, startedAt);
    this.store.event.createTier1StatusEvent({
      taskId: input.taskId,
      executionId: null,
      eventType: "workflow:step_started",
      traceId: buildRealTaskTraceId(input.taskId),
      payload: {
        stepId: "real_model",
        provider: "minimax",
        model: this.model,
      },
    });

    try {
      const report = await this.generateReportWithRetry(input);
      const completedAt = nowIso();
      const artifactRefs = this.recordArtifacts(input, report, completedAt);
      this.store.workflow.insertStepOutput({
        id: newId("step"),
        taskId: input.taskId,
        nodeRunId: newId("nrun"),
        stepId: "real_model",
        roleId: "minimax",
        status: "succeeded",
        dataJson: JSON.stringify({
          outputSummary: report.outputSummary,
          reportPath: report.reportPath,
          reportJsonPath: report.reportJsonPath,
          planTaskCount: report.planTaskCount,
        }),
        summary: report.outputSummary,
        artifactsJson: JSON.stringify(artifactRefs),
        tokenCost: 0,
        durationMs: 0,
        validationJson: JSON.stringify({
          provider: "minimax",
          model: this.model,
          artifactCount: artifactRefs.length,
        }),
        producedAt: completedAt,
      });
      this.store.workflow.updateWorkflowState(
        input.taskId,
        "completed",
        1,
        JSON.stringify({
          outputSummary: report.outputSummary,
          reportPath: report.reportPath,
          reportJsonPath: report.reportJsonPath,
          planTaskCount: report.planTaskCount,
        }),
        completedAt,
        null,
      );
      this.store.event.createTier1StatusEvent({
        taskId: input.taskId,
        executionId: null,
        eventType: "workflow:step_completed",
        traceId: buildRealTaskTraceId(input.taskId),
        payload: {
          stepId: "real_model",
          status: "succeeded",
          provider: "minimax",
          model: this.model,
          artifactRefs,
        },
      });
      this.store.task.updateTaskOutput(input.taskId, JSON.stringify({
        executionMode: "real_model",
        modelCallStatus: "succeeded",
        modelProvider: "minimax",
        modelName: this.model,
        outputSummary: report.outputSummary,
        outputUri: report.reportPath,
        reportJsonPath: report.reportJsonPath,
        planTaskCount: report.planTaskCount,
      }), completedAt);
      this.store.task.updateTaskStatus(input.taskId, "done", completedAt, null, completedAt);
    } catch (error) {
      const failedAt = nowIso();
      const message = error instanceof Error ? error.message : String(error);
      this.store.workflow.insertStepOutput({
        id: newId("step"),
        taskId: input.taskId,
        nodeRunId: newId("nrun"),
        stepId: "real_model",
        roleId: "minimax",
        status: "failed",
        dataJson: JSON.stringify({ error: message }),
        summary: message.slice(0, 180),
        artifactsJson: JSON.stringify([]),
        tokenCost: 0,
        durationMs: 0,
        validationJson: JSON.stringify({
          provider: "minimax",
          model: this.model,
          failed: true,
        }),
        producedAt: failedAt,
      });
      this.store.workflow.updateWorkflowState(
        input.taskId,
        "failed",
        0,
        JSON.stringify({ error: message }),
        failedAt,
        "real_model",
      );
      this.store.event.createTier1StatusEvent({
        taskId: input.taskId,
        executionId: null,
        eventType: "workflow:step_failed",
        traceId: buildRealTaskTraceId(input.taskId),
        payload: {
          stepId: "real_model",
          status: "failed",
          provider: "minimax",
          model: this.model,
          error: message,
        },
      });
      this.store.task.updateTaskOutput(input.taskId, JSON.stringify({
        executionMode: "real_model",
        modelCallStatus: "failed",
        modelProvider: "minimax",
        modelName: this.model,
        outputSummary: message.slice(0, 180),
      }), failedAt);
      this.store.task.updateTaskStatus(input.taskId, "failed", failedAt, "real_task_execution_failed", failedAt);
    }
  }

  private async generateReportWithRetry(input: RealTaskExecutionRequest): Promise<GeneratedTaskReport> {
    let attempt = 0;
    while (true) {
      try {
        return await this.generateReport(input);
      } catch (error) {
        if (!this.isRetryableRealTaskError(error) || attempt >= REAL_TASK_EXECUTION_MAX_ATTEMPTS - 1) {
          throw error;
        }
        await sleep(Math.min(2_000 * 2 ** attempt, 10_000));
        attempt += 1;
      }
    }
  }

  private isRetryableRealTaskError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return RETRYABLE_REAL_TASK_ERROR_PATTERN.test(message);
  }

  private async generateReport(input: RealTaskExecutionRequest): Promise<GeneratedTaskReport> {
    const nlEntry = new NlEntryService();
    const taskBuild = await nlEntry.buildTask({
      message: input.title,
      userId: input.requestedBy ?? "local-dev-operator",
      tenantId: "local-dev",
      locale: "zh-CN",
    });
    const decomposition = await new GoalDecompositionService({
      llmPlanGenerator: new UnifiedChatPlanGenerator({
        provider: this.provider,
        model: this.model,
      }),
    }).decompose(buildGoal(input));
    const markdown = await this.provider.complete(
      [
        "请基于以下任务生成中文 Markdown 报告。",
        "",
        `任务主题：${input.title}`,
        `任务归属：${input.divisionId ?? "platform"}`,
        `NL 摘要：${taskBuild.humanSummary}`,
        "",
        "拆解任务：",
        ...decomposition.tasks.map((task, index) => `${index + 1}. [${task.domainId}] ${task.description}`),
        "",
        "报告要求：",
        "1. 给出 5-8 类能提升代码工作效率/质量的方法。",
        "2. 每类写清原理、适用场景、收益、落地建议。",
        "3. 最后输出 30/60/90 天执行计划。",
        "4. 不要输出 JSON，只输出 Markdown。",
      ].join("\n"),
      {
        model: this.model,
        system: "You are a senior engineering effectiveness researcher. Produce concise, executable Chinese markdown.",
        temperature: 0.2,
        maxTokens: 2600,
        traceId: `real-task:${input.taskId}`,
        tenantId: "local-dev",
        costTag: "task_cockpit.real_task_execution",
      },
    );

    mkdirSync(this.options.reportRoot, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = `${slugifyTaskTitle(input.title)}-${timestamp}`;
    const reportPath = join(this.options.reportRoot, `${baseName}.md`);
    const reportJsonPath = join(this.options.reportRoot, `${baseName}.json`);
    writeFileSync(reportPath, markdown, "utf8");
    const reportJson = JSON.stringify({
      request: input,
      taskBuild,
      decomposition,
      reportPath,
      generatedAt: nowIso(),
      model: this.model,
      provider: "minimax",
    }, null, 2);
    writeFileSync(reportJsonPath, reportJson, "utf8");

    return {
      outputSummary: summarizeMarkdown(markdown),
      reportPath,
      reportJsonPath,
      planTaskCount: decomposition.tasks.length,
      markdown,
      reportJson,
    };
  }

  private ensureWorkflowState(input: RealTaskExecutionRequest, updatedAt: string): void {
    const existingWorkflow = this.store.workflow.getWorkflowState(input.taskId);
    if (existingWorkflow == null) {
      this.store.workflow.insertWorkflowState({
        taskId: input.taskId,
        divisionId: input.divisionId ?? "platform",
        workflowId: "real_task_execution",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: "real_model",
        startedAt: updatedAt,
        updatedAt,
      });
      return;
    }
    this.store.workflow.updateWorkflowState(
      input.taskId,
      "running",
      existingWorkflow.currentStepIndex,
      existingWorkflow.outputsJson,
      updatedAt,
      existingWorkflow.resumableFromStep ?? "real_model",
    );
  }

  private recordArtifacts(input: RealTaskExecutionRequest, report: GeneratedTaskReport, createdAt: string): readonly string[] {
    const lineageJson = JSON.stringify({
      source: "real_task_execution",
      provider: "minimax",
      model: this.model,
      taskId: input.taskId,
    });
    const markdownArtifactId = newId("artifact");
    const jsonArtifactId = newId("artifact");
    this.store.artifact.insertArtifact({
      artifactId: markdownArtifactId,
      taskId: input.taskId,
      executionId: null,
      stepId: "real_model",
      kind: "report_markdown",
      storagePath: report.reportPath,
      fileName: basename(report.reportPath),
      mimeType: "text/markdown",
      sizeBytes: Buffer.byteLength(report.markdown, "utf8"),
      checksum: sha256(report.markdown),
      lineageJson,
      createdAt,
    });
    this.store.artifact.insertArtifact({
      artifactId: jsonArtifactId,
      taskId: input.taskId,
      executionId: null,
      stepId: "real_model",
      kind: "report_json",
      storagePath: report.reportJsonPath,
      fileName: basename(report.reportJsonPath),
      mimeType: "application/json",
      sizeBytes: Buffer.byteLength(report.reportJson, "utf8"),
      checksum: sha256(report.reportJson),
      lineageJson,
      createdAt,
    });
    return [
      `artifact://${markdownArtifactId}`,
      `artifact://${jsonArtifactId}`,
    ];
  }
}
