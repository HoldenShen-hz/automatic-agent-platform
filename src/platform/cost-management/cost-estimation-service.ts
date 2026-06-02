import type { AuthoritativeSqlDatabase } from "../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type {
  CostEstimate,
  CostEstimationConfig,
  CostEstimationScope,
  CostEstimationServicePort,
} from "../contracts/types/cost.js";

export type {
  CostEstimate,
  CostEstimationConfig,
  CostEstimationScope,
  CostEstimationServicePort,
} from "../contracts/types/cost.js";

const DEFAULT_CONFIG: Required<CostEstimationConfig> = {
  highConfidenceThreshold: 20,
  mediumConfidenceThreshold: 5,
  defaultCostUsd: 0.05,
};

export class CostEstimationService implements CostEstimationServicePort {
  private readonly config: Required<CostEstimationConfig>;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    config?: CostEstimationConfig,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public estimate(scope?: string | CostEstimationScope | null, tenantIdOverride?: string | null): CostEstimate {
    const { divisionId, tenantId } = normalizeScope(scope, tenantIdOverride);
    if (divisionId) {
      const divisionSql = tenantId == null
        ? `SELECT AVG(ce.cost_usd) AS avg_cost, COUNT(*) AS sample_count
           FROM cost_events ce
           INNER JOIN tasks t ON ce.task_id = t.id
           WHERE t.division_id = ?
             AND t.status IN ('done', 'failed')
             AND ce.cost_usd > 0`
        : `SELECT AVG(ce.cost_usd) AS avg_cost, COUNT(*) AS sample_count
           FROM cost_events ce
           INNER JOIN tasks t ON ce.task_id = t.id
           WHERE t.division_id = ?
             AND t.tenant_id = ?
             AND t.status IN ('done', 'failed')
             AND ce.cost_usd > 0`;
      const divisionResult = this.db.connection
        .prepare(divisionSql)
        .get(...(tenantId == null ? [divisionId] : [divisionId, tenantId])) as { avg_cost: number | null; sample_count: number } | undefined;

      if (divisionResult?.avg_cost != null && divisionResult.sample_count > 0) {
        return {
          estimatedCostUsd: Math.round(divisionResult.avg_cost * 10000) / 10000,
          confidence: this.assessConfidence(divisionResult.sample_count),
          sampleCount: divisionResult.sample_count,
          divisionId,
          basedOn: "division_avg",
        };
      }
    }

    const globalResult = tenantId == null
      ? this.db.connection
        .prepare(
          `SELECT AVG(cost_usd) AS avg_cost, COUNT(*) AS sample_count
           FROM cost_events
           WHERE cost_usd > 0`,
        )
        .get() as { avg_cost: number | null; sample_count: number } | undefined
      : this.db.connection
        .prepare(
          `SELECT AVG(ce.cost_usd) AS avg_cost, COUNT(*) AS sample_count
           FROM cost_events ce
           INNER JOIN tasks t ON ce.task_id = t.id
           WHERE t.tenant_id = ?
             AND t.status IN ('done', 'failed')
             AND ce.cost_usd > 0`,
        )
        .get(tenantId) as { avg_cost: number | null; sample_count: number } | undefined;

    if (globalResult?.avg_cost != null && globalResult.sample_count > 0) {
      return {
        estimatedCostUsd: Math.round(globalResult.avg_cost * 10000) / 10000,
        confidence: this.assessConfidence(globalResult.sample_count),
        sampleCount: globalResult.sample_count,
        divisionId: null,
        basedOn: "global_avg",
      };
    }

    return {
      estimatedCostUsd: this.config.defaultCostUsd,
      confidence: "default",
      sampleCount: 0,
      divisionId: null,
      basedOn: "default",
    };
  }

  private assessConfidence(sampleCount: number): "high" | "medium" | "low" {
    if (sampleCount >= this.config.highConfidenceThreshold) {
      return "high";
    }
    if (sampleCount >= this.config.mediumConfidenceThreshold) {
      return "medium";
    }
    return "low";
  }
}

function normalizeScope(
  scope?: string | CostEstimationScope | null,
  tenantIdOverride?: string | null,
): { divisionId: string | null; tenantId: string | null } {
  if (typeof scope === "string" || scope == null) {
    return {
      divisionId: scope?.trim() ? scope : null,
      tenantId: tenantIdOverride?.trim() ? tenantIdOverride : null,
    };
  }
  return {
    divisionId: scope.divisionId?.trim() ? scope.divisionId : null,
    tenantId: tenantIdOverride?.trim() ? tenantIdOverride : (scope.tenantId?.trim() ? scope.tenantId : null),
  };
}
