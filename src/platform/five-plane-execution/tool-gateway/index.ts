import type { CommandExecutionResult, CommandExecutor } from "../tool-executor/command-executor.js";
import { ToolExecutor, type ToolExecutorOptions } from "../tool-executor/tool-executor.js";
import type { CommandToolRequest, ToolExecutionMetadata } from "../tool-executor/tool-metadata.js";
import type {
  ParallelToolExecutionResult,
  ParallelToolExecutorOptions,
  ToolExecutionItem,
} from "../tool-executor/tool-parallel-executor.js";
import type { OutboxRecord } from "../../shared/outbox/outbox-types.js";
import {
  createBaseReceiptMinimal,
  type BaseReceiptMinimal,
  type BaseReceiptStatus,
} from "../../five-plane-state-evidence/receipts/index.js";

export {
  ShadowSnapshotService,
  type ShadowSnapshotRecord,
  type ShadowSnapshotRestoreResult,
  type ShadowSnapshotServiceOptions,
} from "../tool-executor/shadow-snapshot-service.js";
export {
  SemanticRepoMapService,
  extractImports,
  extractSymbols,
  type RepoFileNode,
  type RepoReference,
  type RepoSymbol,
  type SemanticQuery,
  type SemanticRepoMap,
  type SemanticSearchResult,
} from "../tool-executor/semantic-repo-map-service.js";
export {
  SkillCreatorService,
  slugifySkillName,
  type CreateSkillRequest,
  type SkillCreatorAction,
  type SkillCreatorResourceDirectory,
  type SkillCreatorResult,
  type SkillScaffoldValidationResult,
  type ValidateSkillScaffoldRequest,
} from "../tool-executor/skill-creator-service.js";
export {
  SkillGovernanceService,
  type SkillLifecycle,
  type SkillMetadata,
  type SkillRiskLevel,
  type ValidateSkillResult,
} from "../tool-executor/skill-governance-service.js";
export {
  sanitizeStructuredOutput,
  sanitizeToolOutput,
  type InjectionRisk,
  type PromptInjectionRuleId,
  type SanitizedStructuredOutput,
  type SanitizedToolOutput,
  type SanitizeOutputOptions,
} from "../tool-executor/tool-output-sanitizer.js";
export {
  checkToolPathScope,
  hasToolPathScopeRestrictions,
  normalizeToolPathScopeRoots,
  type ToolPathScopeCheckResult,
} from "../tool-executor/tool-path-scope.js";
export {
  expandToolNames,
  inferPromotedToolNames,
  type ExpandedToolNames,
  type ToolNameCorrection,
  type ToolRecommendation,
  type ToolRecommendExposureResult,
  type ToolRecommendRequest,
  type ToolRecommendResult,
} from "../tool-executor/tool-recommend-service.js";
export {
  listBuiltinToolExecutionMetadata,
  resolveToolExecutionMetadata,
  type CommandToolRequest,
  type ToolExecutionMetadata,
} from "../tool-executor/tool-metadata.js";
export { ToolExecutor, type ToolExecutorOptions } from "../tool-executor/tool-executor.js";

export type ToolGatewayActionPhase = "prepare" | "commit" | "verify" | "compensate";

export interface ToolGatewayShadow {
  phase: ToolGatewayActionPhase;
  receipt: BaseReceiptMinimal;
  outboxRecord: OutboxRecord | null;
}

export interface ToolGatewayOutboxPort {
  writeOutboxEntry(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
    traceId?: string | null,
  ): OutboxRecord;
}

export interface ToolGatewayActionContext {
  toolName: string;
  tenantId: string;
  missionId: string;
  traceId: string;
  actorId: string;
  taskId?: string;
  sessionId?: string;
  executionId?: string | null;
  schemaVersion?: string;
  evidenceIds?: readonly string[];
  inputHash?: string;
  outputHash?: string;
}

export interface ToolGatewayVerificationInput {
  verified: boolean;
  outputHash?: string;
  evidenceIds?: readonly string[];
}

export interface ToolGatewayCompensationInput {
  reason: string;
  evidenceIds?: readonly string[];
}

export interface ToolGatewayOptions extends Omit<ToolExecutorOptions, "commandExecutor"> {
  commandExecutor?: CommandExecutor;
  executor?: ToolExecutor;
  outbox?: ToolGatewayOutboxPort;
}

export class ToolGateway {
  private readonly executor: ToolExecutor | null;
  private readonly outbox: ToolGatewayOutboxPort | null;

  public constructor(options: ToolGatewayOptions = {}) {
    this.executor = options.executor
      ?? (options.commandExecutor != null
        ? new ToolExecutor(
          options.commandExecutor,
          options.parallelOptions != null ? { parallelOptions: options.parallelOptions } : {},
        )
        : null);
    this.outbox = options.outbox ?? null;
  }

  public executeCommand(request: CommandToolRequest, signal?: AbortSignal): Promise<CommandExecutionResult> {
    if (this.executor == null) {
      throw new Error("tool_gateway.executor_missing");
    }
    return this.executor.executeCommand(request, signal);
  }

  public executeParallel<T>(
    items: readonly ToolExecutionItem<T>[],
    options: ParallelToolExecutorOptions = {},
  ): Promise<ParallelToolExecutionResult<T>> {
    if (this.executor == null) {
      throw new Error("tool_gateway.executor_missing");
    }
    return this.executor.executeParallel(items, options);
  }

  public prepareToolAction(context: ToolGatewayActionContext): ToolGatewayShadow {
    return this.buildPhaseShadow("prepare", context, "prepared");
  }

  public commitToolAction(context: ToolGatewayActionContext): ToolGatewayShadow {
    return this.buildPhaseShadow("commit", context, "committed");
  }

  public verifyToolAction(
    context: ToolGatewayActionContext,
    input: ToolGatewayVerificationInput,
  ): ToolGatewayShadow {
    const mergedContext: ToolGatewayActionContext = {
      ...context,
      evidenceIds: [...new Set([...(context.evidenceIds ?? []), ...(input.evidenceIds ?? [])])],
      ...(input.outputHash != null
        ? { outputHash: input.outputHash }
        : context.outputHash != null
          ? { outputHash: context.outputHash }
          : {}),
    };
    return this.buildPhaseShadow("verify", mergedContext, input.verified ? "success" : "failed");
  }

  public compensateToolAction(
    context: ToolGatewayActionContext,
    input: ToolGatewayCompensationInput,
  ): ToolGatewayShadow {
    return this.buildPhaseShadow("compensate", {
      ...context,
      evidenceIds: [...new Set([...(context.evidenceIds ?? []), ...(input.evidenceIds ?? []), input.reason])],
    }, "failed");
  }

  private buildPhaseShadow(
    phase: ToolGatewayActionPhase,
    context: ToolGatewayActionContext,
    status: BaseReceiptStatus,
  ): ToolGatewayShadow {
    const actionType = `tool.${phase}:${context.toolName}`;
    const receipt = createBaseReceiptMinimal({
      tenantId: context.tenantId,
      missionId: context.missionId,
      traceId: context.traceId,
      actorId: context.actorId,
      actionType,
      status,
      ...(context.taskId != null ? { taskId: context.taskId } : {}),
      ...(context.sessionId != null ? { sessionId: context.sessionId } : {}),
      ...(context.schemaVersion != null ? { schemaVersion: context.schemaVersion } : {}),
      ...(context.evidenceIds != null ? { evidenceIds: context.evidenceIds } : {}),
      ...(context.inputHash != null ? { inputHash: context.inputHash } : {}),
      ...(context.outputHash != null ? { outputHash: context.outputHash } : {}),
    });
    const outboxRecord = this.outbox?.writeOutboxEntry(
      context.executionId != null ? "execution" : "task",
      context.executionId ?? context.taskId ?? receipt.receiptId,
      `tool_gateway:${phase}`,
      {
        receipt,
        toolName: context.toolName,
        phase,
      },
      context.traceId,
    ) ?? null;
    return { phase, receipt, outboxRecord };
  }
}
