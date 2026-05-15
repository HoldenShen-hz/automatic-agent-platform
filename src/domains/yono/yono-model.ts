import { z } from "zod";

export const YONO_DOMAIN_ID = "yono";

export const YonoCategorySchema = z.enum(["web3", "ai", "macro", "sports", "tech", "social", "custom"]);
export const YonoRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const YonoMarketStatusSchema = z.enum([
  "draft",
  "pending_review",
  "open",
  "paused",
  "closed",
  "resolving",
  "resolved",
  "disputed",
  "cancelled",
]);

export const YonoOutcomeSchema = z.object({
  outcomeId: z.string().min(1),
  marketId: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["yes", "no", "choice", "range"]),
  currentPrice: z.number().min(0).max(1),
  impliedProbability: z.number().min(0).max(1),
  liquidityUsd: z.number().nonnegative(),
}).strict();
export type YonoOutcome = z.infer<typeof YonoOutcomeSchema>;

export const YonoMarketSchema = z.object({
  marketId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: YonoCategorySchema,
  outcomeType: z.enum(["binary", "multi_choice", "scalar"]),
  outcomes: z.array(YonoOutcomeSchema).min(2),
  openAt: z.string().min(1),
  closeAt: z.string().min(1),
  resolutionDeadline: z.string().min(1),
  status: YonoMarketStatusSchema,
  creatorId: z.string().min(1),
  resolverPolicyId: z.string().min(1),
  oraclePolicyId: z.string().min(1).optional(),
  liquidity: z.object({
    totalLiquidityUsd: z.number().nonnegative(),
    volume24hUsd: z.number().nonnegative(),
    volumeTotalUsd: z.number().nonnegative(),
  }),
  probability: z.object({
    marketProbability: z.number().min(0).max(1),
    yonoConsensusProbability: z.number().min(0).max(1).optional(),
    aiEvidenceProbability: z.number().min(0).max(1).optional(),
    commentSignalProbability: z.number().min(0).max(1).optional(),
    expertProbability: z.number().min(0).max(1).optional(),
    updatedAt: z.string().min(1),
  }),
  risk: z.object({
    manipulationRisk: YonoRiskLevelSchema,
    resolutionRisk: z.enum(["low", "medium", "high"]),
    ambiguityRisk: z.enum(["low", "medium", "high"]),
    regulatoryRisk: z.enum(["low", "medium", "high"]),
  }),
  tags: z.array(z.string()),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}).strict();
export type YonoMarket = z.infer<typeof YonoMarketSchema>;
export type YonoCategory = z.infer<typeof YonoCategorySchema>;

export const YonoCommentSchema = z.object({
  commentId: z.string().min(1),
  marketId: z.string().min(1),
  userId: z.string().min(1),
  parentCommentId: z.string().min(1).optional(),
  text: z.string().min(1),
  createdAt: z.string().min(1),
  editedAt: z.string().min(1).optional(),
  deletedAt: z.string().min(1).optional(),
  engagement: z.object({
    likes: z.number().int().nonnegative(),
    replies: z.number().int().nonnegative(),
    shares: z.number().int().nonnegative(),
    reports: z.number().int().nonnegative(),
  }),
  source: z.enum(["market_comment", "post", "reply", "external_import"]),
  visibility: z.enum(["public", "limited", "hidden"]),
  moderationStatus: z.enum(["visible", "flagged", "hidden", "removed", "under_review"]),
}).strict();
export type YonoComment = z.infer<typeof YonoCommentSchema>;

export const YonoCommentSignalSchema = z.object({
  signalId: z.string().min(1),
  commentId: z.string().min(1),
  marketId: z.string().min(1),
  stance: z.enum(["yes", "no", "neutral", "unclear"]),
  probability: z.number().min(0).max(1).nullable(),
  evidenceBacked: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
  extractedAt: z.string().min(1),
}).strict();
export type YonoCommentSignal = z.infer<typeof YonoCommentSignalSchema>;

export const YonoForecastSchema = z.object({
  forecastId: z.string().min(1),
  marketId: z.string().min(1),
  userId: z.string().min(1),
  probability: z.number().min(0).max(1),
  outcomeId: z.string().min(1),
  rationale: z.string().optional(),
  forecastType: z.enum(["explicit_probability", "trade_implied", "comment_inferred"]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1).optional(),
  settlement: z.object({
    finalOutcomeId: z.string().min(1),
    brierScore: z.number().nonnegative(),
    logLoss: z.number().nonnegative(),
    isCorrectDirection: z.boolean(),
  }).optional(),
}).strict();
export type YonoForecast = z.infer<typeof YonoForecastSchema>;

export const YonoOrderSchema = z.object({
  orderId: z.string().min(1),
  marketId: z.string().min(1),
  outcomeId: z.string().min(1),
  userId: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  orderType: z.enum(["market", "limit"]),
  quantity: z.number().positive(),
  limitPrice: z.number().min(0).max(1).optional(),
  status: z.enum(["pending", "accepted", "partially_filled", "filled", "cancelled", "rejected", "expired"]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}).strict();
export type YonoOrder = z.infer<typeof YonoOrderSchema>;

export const YonoTradeSchema = z.object({
  tradeId: z.string().min(1),
  marketId: z.string().min(1),
  outcomeId: z.string().min(1),
  buyerUserId: z.string().min(1),
  sellerUserId: z.string().min(1).optional(),
  price: z.number().min(0).max(1),
  quantity: z.number().positive(),
  feeUsd: z.number().nonnegative(),
  createdAt: z.string().min(1),
}).strict();
export type YonoTrade = z.infer<typeof YonoTradeSchema>;

export const YonoPositionSchema = z.object({
  positionId: z.string().min(1),
  marketId: z.string().min(1),
  outcomeId: z.string().min(1),
  userId: z.string().min(1),
  quantity: z.number(),
  averagePrice: z.number().min(0).max(1),
  currentPrice: z.number().min(0).max(1),
  unrealizedPnl: z.number(),
  realizedPnl: z.number(),
  updatedAt: z.string().min(1),
}).strict();
export type YonoPosition = z.infer<typeof YonoPositionSchema>;

export const YonoDisputeSchema = z.object({
  disputeId: z.string().min(1),
  marketId: z.string().min(1),
  raisedBy: z.string().min(1),
  reason: z.enum(["ambiguous_criteria", "wrong_evidence", "oracle_error", "manipulation", "other"]),
  evidenceRefs: z.array(z.string()),
  status: z.enum(["submitted", "under_review", "accepted", "rejected", "resolved"]),
  createdAt: z.string().min(1),
  resolvedAt: z.string().min(1).optional(),
}).strict();
export type YonoDispute = z.infer<typeof YonoDisputeSchema>;

export const YonoEventTypeSchema = z.enum([
  "yono.market.created",
  "yono.market.review_requested",
  "yono.market.approved",
  "yono.market.opened",
  "yono.market.paused",
  "yono.market.closed",
  "yono.market.resolution_proposed",
  "yono.market.resolved",
  "yono.market.disputed",
  "yono.comment.created",
  "yono.comment.signal_extracted",
  "yono.forecast.submitted",
  "yono.order.created",
  "yono.trade.executed",
  "yono.position.updated",
  "yono.reputation.updated",
  "yono.manipulation.detected",
  "yono.consensus_probability.updated",
]);
export type YonoEventType = z.infer<typeof YonoEventTypeSchema>;

export interface YonoEventEnvelope<TPayload = unknown> {
  readonly eventId: string;
  readonly eventType: YonoEventType;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export interface SocialForecastOutput {
  readonly marketId: string;
  readonly commentSignalProbability: number;
  readonly weightedYesSignal: number;
  readonly weightedNoSignal: number;
  readonly highReputationYesRatio: number;
  readonly highReputationNoRatio: number;
  readonly evidenceBackedCommentRatio: number;
  readonly manipulationRisk: "low" | "medium" | "high" | "critical";
  readonly trend: "bullish" | "bearish" | "mixed" | "neutral";
  readonly confidence: "low" | "medium" | "high";
  readonly explanation: string;
  readonly evidenceRefs: readonly string[];
}

export interface MarketReviewResult {
  readonly marketId: string;
  readonly decision: "approve" | "reject" | "needs_revision" | "manual_review";
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly issues: readonly string[];
  readonly requiredChanges: readonly string[];
}

export interface ResolutionDraft {
  readonly marketId: string;
  readonly proposedOutcomeId: string;
  readonly confidence: number;
  readonly evidenceRefs: readonly string[];
  readonly reasoningSummary: string;
  readonly ambiguityFlags: readonly string[];
  readonly requiresHumanReview: boolean;
}
