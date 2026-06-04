import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { nowIso } from "../../contracts/types/ids.js";
import { NlEntryService } from "../../../interaction/nl-gateway/index.js";
import { GoalDecompositionService, type Goal } from "../../../interaction/goal-decomposer/index.js";
import { UnifiedChatPlanGenerator } from "../../../interaction/goal-decomposer/llm-plan-generator.js";
import { createUnifiedChatProvider, type UnifiedChatProvider } from "../../model-gateway/provider-registry/unified-chat-provider.js";

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

    try {
      const report = await this.generateReport(input);
      const completedAt = nowIso();
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
    writeFileSync(reportJsonPath, JSON.stringify({
      request: input,
      taskBuild,
      decomposition,
      reportPath,
      generatedAt: nowIso(),
      model: this.model,
      provider: "minimax",
    }, null, 2), "utf8");

    return {
      outputSummary: summarizeMarkdown(markdown),
      reportPath,
      reportJsonPath,
      planTaskCount: decomposition.tasks.length,
    };
  }
}
