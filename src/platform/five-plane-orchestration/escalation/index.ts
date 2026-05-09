/**
 * Platform Panic Integration for Escalation Decisions
 *
 * Integrates the PlatformPanicService with escalation decisions.
 * When riskLevel is critical and affects production, triggers actual
 * platform panic activation rather than just returning a decision string.
 *
 * §R14-01: Integrated PlatformPanicService for actual panic propagation,
 * state saving, and recovery protocol execution.
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { PanicFreezeMode, PanicScopeLevel } from "../../ops-maturity/platform-panic/index.js";
import { PlatformPanicService } from "../../ops-maturity/platform-panic/index.js";

export type EscalationRiskLevel = "low" | "medium" | "high" | "critical";
export type EscalationDecisionType = "none" | "approval" | "takeover" | "panic_stop" | "panic_activate";
export type EscalationStage = "assess" | "plan" | "execute" | "feedback" | "improve" | "release";

/**
 * Structured panic directive issued by escalation.
 * Carries all information needed for PlatformPanicService activation.
 * §R14-01: State-saving and recovery protocol data structure.
 */
export interface EscalationPanicDirective {
  readonly directiveId: string;
  readonly scope: string;
  readonly scopeLevel: PanicScopeLevel;
  readonly reasonCode: string;
  readonly issuedBy: string;
  readonly issuedAt: string;
  readonly freezeModes: readonly PanicFreezeMode[];
  readonly activeIncidents: number;
  readonly forensicSnapshotRequested: boolean;
}

/**
 * Result of an escalation decision with optional panic activation.
 * §R14-01: Includes panic activation result when decision is panic_activate.
 */
export interface EscalationDecision {
  decision: EscalationDecisionType;
  reasonCode: string;
  requiresOperatorAction: boolean;
  panicActivation?: {
    activated: boolean;
    directiveId: string | null;
    error?: string;
  };
}

export interface EscalationRequest {
  taskId: string;
  executionId: string | null;
  tenantId: string | null;
  stage: EscalationStage;
  riskLevel: EscalationRiskLevel;
  reasonCode: string;
  estimatedCostUsd: number | null;
  affectsProduction: boolean;
  /** R29-07 fix: SLA deadline for routing decisions — null means no SLA constraint */
  slaDeadline: string | null;
  /** R29-07 fix: Timeout in milliseconds for human takeover — exceeded SLA triggers escalation */
  timeoutMs: number | null;
}

/**
 * Default freeze modes for platform panic.
 * §R14-01: Defines which operations are halted during panic.
 */
const DEFAULT_PANIC_FREEZE_MODES: readonly PanicFreezeMode[] = ["deploy", "automation"];

/**
 * EscalationService with integrated Platform Panic propagation.
 *
 * §R14-01: When critical production issues occur, this service:
 * 1. Creates a structured EscalationPanicDirective
 * 2. Calls PlatformPanicService.activate() to trigger cascade halt
 * 3. Propagates state to all planes (P1-P5) with acknowledgment tracking
 * 4. Saves forensic snapshot for post-mortem analysis
 * 5. Returns activation result for operator awareness
 */
export class EscalationService {
  private readonly panicService: PlatformPanicService;

  public constructor(panicService?: PlatformPanicService) {
    this.panicService = panicService ?? new PlatformPanicService();
  }

  /**
   * Makes an escalation decision, optionally triggering platform panic
   * for critical production issues.
   *
   * §R14-01: Platform panic integration for critical production failures.
   */
  public decide(input: EscalationRequest): EscalationDecision {
    // Critical + production = trigger platform panic with full propagation
    if (input.riskLevel === "critical" && input.affectsProduction) {
      const activation = this.tryActivatePanic(input);
      const panicActivation: EscalationDecision["panicActivation"] = {
        activated: activation.activated,
        directiveId: activation.directiveId ?? null,
      };
      if (activation.error) {
        panicActivation.error = activation.error;
      }
      return {
        decision: activation.activated ? "panic_activate" : "panic_stop",
        reasonCode: activation.error ?? "escalation.critical_prod_panic",
        requiresOperatorAction: true,
        panicActivation,
      };
    }

    // High risk or critical (non-production) = human takeover
    if (input.riskLevel === "critical" || (input.riskLevel === "high" && input.stage === "execute")) {
      return {
        decision: "takeover",
        reasonCode: "escalation.human_takeover_required",
        requiresOperatorAction: true,
      };
    }

    // Production-affecting or high cost = approval required
    if (input.affectsProduction || (input.estimatedCostUsd ?? 0) >= 10 || input.riskLevel === "high") {
      return {
        decision: "approval",
        reasonCode: "escalation.approval_required",
        requiresOperatorAction: true,
      };
    }

    return {
      decision: "none",
      reasonCode: "escalation.not_required",
      requiresOperatorAction: false,
    };
  }

  /**
   * Attempts to activate platform panic via PlatformPanicService.
   *
   * §R14-01: Actual panic activation with propagation to all planes.
   * Returns structured result indicating success/failure and directive ID.
   */
  private tryActivatePanic(input: EscalationRequest): {
    activated: boolean;
    directiveId: string | null;
    error: string | null;
  } {
    try {
      // Build panic activation request with required fields
      const scope = input.tenantId ? `tenant/${input.tenantId}` : "platform/global";

      // Create forensic snapshot request for post-mortem
      const forensicSnapshotRequested = true;

      const directive: EscalationPanicDirective = {
        directiveId: newId("esc_panic"),
        scope,
        scopeLevel: input.tenantId ? "tenant" : "platform",
        reasonCode: input.reasonCode,
        issuedBy: "escalation_service",
        issuedAt: nowIso(),
        freezeModes: DEFAULT_PANIC_FREEZE_MODES,
        activeIncidents: 1,
        forensicSnapshotRequested,
      };

      // Activate via PlatformPanicService - this triggers:
      // 1. Forensic snapshot capture
      // 2. Propagation records creation
      // 3. Cascade halt directives to all planes (P1-P5)
      // 4. Acknowledgment tracking
      const activation = this.panicService.activate({
        scope: directive.scope,
        reasonCode: directive.reasonCode,
        issuedBy: directive.issuedBy,
        issuedAt: directive.issuedAt,
        freezeModes: directive.freezeModes,
        forensicArtifactIds: [],
        severity: "full",
        activeIncidents: directive.activeIncidents,
      });

      return {
        activated: true,
        directiveId: activation.directive.directiveId,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        activated: false,
        directiveId: null,
        error: `panic.activation_failed: ${message}`,
      };
    }
  }

  /**
   * Gets the integrated panic service for direct access if needed.
   * §R14-01: Exposes panic service for state queries and recovery.
   */
  public getPanicService(): PlatformPanicService {
    return this.panicService;
  }
}