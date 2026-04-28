import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export type HumanWaitStatus = "requested" | "approved" | "rejected" | "expired" | "cancelled";
export type HumanWaitTimeoutPolicy = "reject" | "approve" | "remain_pending";

export interface HumanWaitExecutionContext {
  readonly executionId: string;
  readonly taskId: string;
  readonly tenantId: string | null;
  readonly sessionId?: string | null;
  readonly correlationId?: string | null;
}

export interface HumanWaitRequest {
  readonly approvalId?: string;
  readonly title: string;
  readonly reason: string;
  readonly options: readonly string[];
  readonly timeoutPolicy: HumanWaitTimeoutPolicy;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly requestedBy?: string | null;
  readonly requestedAt?: string;
}

export interface HumanWaitResolution {
  readonly status: Exclude<HumanWaitStatus, "requested">;
  readonly resolvedBy?: string | null;
  readonly note?: string | null;
  readonly resolvedAt?: string;
}

export interface HumanWaitExecutionResult {
  readonly approvalId: string;
  readonly executionId: string;
  readonly taskId: string;
  readonly tenantId: string | null;
  readonly status: HumanWaitStatus;
  readonly title: string;
  readonly reason: string;
  readonly options: readonly string[];
  readonly timeoutPolicy: HumanWaitTimeoutPolicy;
  readonly requestedBy: string | null;
  readonly requestedAt: string;
  readonly resolvedBy: string | null;
  readonly resolvedAt: string | null;
  readonly durationMs: number;
  readonly note: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface HumanWaitExecutorOptions {
  readonly now?: () => string;
  readonly idFactory?: () => string;
}

function cloneMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneMetadataValue(entry));
  }
  if (value != null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, cloneMetadataValue(entry)]),
    );
  }
  return value;
}

function createReadonlyMetadataProxy(
  value: Record<string, unknown>,
): Readonly<Record<string, unknown>> {
  return new Proxy(value, {
    set: () => true,
    defineProperty: () => true,
    deleteProperty: () => true,
  });
}

export class HumanWaitExecutor {
  private readonly pending = new Map<string, HumanWaitExecutionResult>();
  private readonly now: () => string;
  private readonly idFactory: () => string;

  public constructor(options: HumanWaitExecutorOptions = {}) {
    this.now = options.now ?? nowIso;
    this.idFactory = options.idFactory ?? (() => newId("approval"));
  }

  public execute(context: HumanWaitExecutionContext, request: HumanWaitRequest): HumanWaitExecutionResult {
    return this.requestApproval(context, request);
  }

  public requestApproval(context: HumanWaitExecutionContext, request: HumanWaitRequest): HumanWaitExecutionResult {
    const title = request.title.trim();
    const reason = request.reason.trim();
    if (title.length === 0 || reason.length === 0) {
      throw new ValidationError("human_wait.invalid_request", "Human wait requests require a title and reason.", {
        details: { title, reason },
      });
    }

    const approvalId = this.allocateApprovalId(request.approvalId?.trim() || this.idFactory());
    const requestedAt = request.requestedAt ?? this.now();
    const metadata = createReadonlyMetadataProxy(
      (cloneMetadataValue(request.metadata ?? {}) as Record<string, unknown>),
    );
    const result: HumanWaitExecutionResult = {
      approvalId,
      executionId: context.executionId,
      taskId: context.taskId,
      tenantId: context.tenantId,
      status: "requested",
      title,
      reason,
      options: request.options.length > 0 ? [...request.options] : ["approve", "reject"],
      timeoutPolicy: request.timeoutPolicy,
      requestedBy: request.requestedBy ?? null,
      requestedAt,
      resolvedBy: null,
      resolvedAt: null,
      durationMs: 0,
      note: null,
      metadata,
    };
    this.pending.set(approvalId, result);
    return result;
  }

  public resolveApproval(approvalId: string, resolution: HumanWaitResolution): HumanWaitExecutionResult {
    const pendingApproval = this.pending.get(approvalId);
    if (pendingApproval == null) {
      throw new ValidationError("human_wait.approval_not_found", "Human wait approval was not found.", {
        details: { approvalId },
      });
    }

    const resolvedAt = resolution.resolvedAt ?? this.now();
    const completed: HumanWaitExecutionResult = {
      ...pendingApproval,
      status: resolution.status,
      resolvedBy: resolution.resolvedBy ?? null,
      resolvedAt,
      durationMs: Math.max(0, Date.parse(resolvedAt) - Date.parse(pendingApproval.requestedAt)),
      note: resolution.note ?? null,
    };
    this.pending.delete(approvalId);
    return completed;
  }

  public getApproval(approvalId: string): HumanWaitExecutionResult | null {
    return this.pending.get(approvalId) ?? null;
  }

  public listPendingApprovals(): readonly HumanWaitExecutionResult[] {
    return [...this.pending.values()];
  }

  private allocateApprovalId(candidate: string): string {
    let approvalId = candidate;
    let suffix = 1;
    while (this.pending.has(approvalId)) {
      approvalId = `${candidate}-${suffix}`;
      suffix += 1;
    }
    return approvalId;
  }
}
