/**
 * @fileoverview Cost Optimization Service
 *
 * Provides cost attribution, aggregation, recommendations, and simulation.
 *
 * §65 Model Right-Sizing Online Profiling Capability (P2 Enhancement for Phase 3):
 * Current implementation supports recommendation generation and simulation based on historical cost data.
 * To implement "online profiling" capability, real-time traffic analysis needs to be integrated,
 * dynamically building model usage distribution profiles, and generating right-sizing recommendations
 * based on actual traffic patterns. Currently recommendation-engine can make static recommendations
 * based on model-metadata-registry, lacking real-time traffic-driven dynamic optimization.
 */

import { nowIso } from "../../platform/contracts/types/ids.js";
import { aggregateCostAttribution } from "./attribution-engine/index.js";
import {
  buildCostOptimizationRecommendation,
  type CostOptimizationRecommendation,
} from "./recommendation-engine/index.js";
import { simulateCostOptimization } from "./simulator/index.js";

export type CostSubjectType = "task" | "workflow" | "agent" | "model" | "domain" | "run";

export interface CostAttributionRecord {
  readonly harness_run_id?: string;
  readonly node_run_id?: string;
  readonly subjectType?: CostSubjectType;
  readonly subjectId?: string;
  readonly costType: "llm" | "tool" | "compute" | "storage" | "egress" | "humanReview" | "total" | "model" | "runtime";
  readonly amountUsd: number;
  readonly llmCostUsd: number;
  readonly toolCostUsd: number;
  readonly computeCostUsd: number;
  readonly storageCostUsd: number;
  readonly egressCostUsd: number;
  readonly humanReviewCostUsd: number;
  readonly qualityRisk?: "low" | "medium" | "high";
  readonly decisionRef: string;
  readonly modelRef?: string;
  readonly capturedAt: string;
}

export interface CostSimulationScenarioInput {
  readonly scenarioId: string;
  readonly subjectId: string;
  readonly reductionPercent: number;
}

export interface CostDashboardSlice {
  readonly generatedAt: string;
  readonly totalCostUsd: number;
  readonly bySubject: Readonly<Record<string, number>>;
  readonly recommendations: readonly CostOptimizationRecommendation[];
  readonly unsourcedRecordCount: number;
}

export interface CostSimulationResult {
  readonly scenarioId: string;
  readonly subjectId: string;
  readonly currentCostUsd: number;
  readonly simulatedCostUsd: number;
  readonly deltaUsd: number;
}

export class CostOptimizationService {
  private readonly records: CostAttributionRecord[] = [];
  private unsourcedRecordCount = 0;

  public recordCost(record: CostAttributionRecord): CostAttributionRecord {
    if (record.decisionRef.trim().length === 0) {
      this.unsourcedRecordCount += 1;
      throw new Error(`cost_optimizer.unsourced_record:${this.resolveSubjectId(record)}`);
    }
    this.records.push(record);
    return record;
  }

  public aggregate(subjectTypeOrHarnessRunId?: string): Record<string, number> {
    const filtered = subjectTypeOrHarnessRunId == null
      ? this.records
      : this.isSubjectType(subjectTypeOrHarnessRunId)
        ? this.records.filter((item) => this.resolveSubjectType(item) === subjectTypeOrHarnessRunId)
        : this.records.filter((item) => this.resolveSubjectId(item) === subjectTypeOrHarnessRunId);
    return aggregateCostAttribution(filtered.map((item) => ({
      subjectId: this.resolveSubjectId(item),
      amountUsd: item.amountUsd,
    })));
  }

  public buildRecommendations(subjectTypeOrHarnessRunId?: string): CostOptimizationRecommendation[] {
    return Object.entries(this.aggregate(subjectTypeOrHarnessRunId))
      .map(([subjectId, cost]) => {
        const modelRef = this.resolveRepresentativeModelRef(subjectId);
        return buildCostOptimizationRecommendation(subjectId, cost, modelRef != null ? { modelRef } : {});
      })
      .filter((item): item is CostOptimizationRecommendation => item != null)
      .map((item) => ({
        ...item,
        riskLevel: this.riskLevelForSubject(item.subjectId, item.riskLevel),
      }));
  }

  public simulate(scenarios: readonly CostSimulationScenarioInput[]): CostSimulationResult[] {
    const aggregated = this.aggregate();
    return scenarios.map((scenario) => {
      const currentCostUsd = aggregated[scenario.subjectId] ?? 0;
      const simulatedCostUsd = simulateCostOptimization(currentCostUsd, scenario.reductionPercent);
      return {
        scenarioId: scenario.scenarioId,
        subjectId: scenario.subjectId,
        currentCostUsd,
        simulatedCostUsd,
        deltaUsd: Number((simulatedCostUsd - currentCostUsd).toFixed(2)),
      };
    });
  }

  public buildDashboardSlice(generatedAt = nowIso()): CostDashboardSlice {
    const bySubject = this.aggregate();
    const totalCostUsd = Number(Object.values(bySubject).reduce((sum, item) => sum + item, 0).toFixed(4));
    return {
      generatedAt,
      totalCostUsd,
      bySubject,
      recommendations: this.buildRecommendations(),
      unsourcedRecordCount: this.unsourcedRecordCount,
    };
  }

  public listRecords(): CostAttributionRecord[] {
    return [...this.records];
  }

  private riskLevelForSubject(
    subjectId: string,
    baseRisk: CostOptimizationRecommendation["riskLevel"],
  ): CostOptimizationRecommendation["riskLevel"] {
    const records = this.records.filter((item) => this.resolveSubjectId(item) === subjectId);
    if (records.some((item) => item.costType === "llm" || item.costType === "model")) {
      return baseRisk === "low" ? "medium" : baseRisk;
    }
    return baseRisk;
  }

  private resolveRepresentativeModelRef(subjectId: string): string | undefined {
    const modelRecord = this.records.find((item) => this.resolveSubjectId(item) === subjectId && typeof item.modelRef === "string" && item.modelRef.length > 0);
    return modelRecord?.modelRef;
  }

  private resolveSubjectId(record: CostAttributionRecord): string {
    return record.subjectId ?? record.harness_run_id ?? "unknown_subject";
  }

  private resolveSubjectType(record: CostAttributionRecord): CostSubjectType {
    return record.subjectType ?? "run";
  }

  private isSubjectType(value: string): value is CostSubjectType {
    return value === "task" || value === "workflow" || value === "agent" || value === "model" || value === "domain" || value === "run";
  }
}
