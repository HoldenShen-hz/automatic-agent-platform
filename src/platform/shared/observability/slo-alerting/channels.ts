import type { AlertChannelKind, AlertEvent, SloStatus } from "./types.js";

export type FetchLike = typeof fetch;

export interface AlertDeliveryResult {
  channelKind: AlertChannelKind;
  delivered: boolean;
  error: string | null;
}

export interface AlertChannel {
  readonly kind: AlertChannelKind;
  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult;
}

export interface ErrorBudgetDegradationResult {
  degraded: boolean;
  sloId: string;
  sloStatus: SloStatus;
  rolloutFrozen: boolean;
  alertFired: boolean;
  alertId: string | null;
}

export interface WebhookAlertChannelOptions {
  fetchImpl?: FetchLike;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
}

export interface SlackAlertChannelOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export interface PagerDutyAlertChannelOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  endpoint?: string;
}

export interface OpsGenieAlertChannelOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  endpoint?: string;
}

export const PAGERDUTY_DEFAULT_ENDPOINT = "https://events.pagerduty.com/v2/enqueue";
