import type { AuthoritativeSqlDatabase } from "../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type {
  CostEstimate,
  CostEstimationConfig,
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

  public estimate(divisionId?: string | null): CostEstimate {
    if (divisionId) {
      const divisionResult = this.db.connection
        .prepare(
          `SELECT AVG(ce.cost_usd) AS avg_cost, COUNT(*) AS sample_count
           FROM cost_events ce
           INNER JOIN tasks t ON ce.task_id = t.id
           WHERE t.division_id = ?
             AND t.status IN ('done', 'failed')
             AND ce.cost_usd > 0`,
        )
        .get(divisionId) as { avg_cost: number | null; sample_count: number } | undefined;

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

    const globalResult = this.db.connection
      .prepare(
        `SELECT AVG(cost_usd) AS avg_cost, COUNT(*) AS sample_count
         FROM cost_events
         WHERE cost_usd > 0`,
      )
      .get() as { avg_cost: number | null; sample_count: number } | undefined;

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
