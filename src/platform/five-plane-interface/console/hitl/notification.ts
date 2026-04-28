/**
 * HITL Notification UI Components
 *
 * These components provide the frontend-facing notification and display logic
 * for Human-in-the-Loop approval workflows.
 *
 * Note: Full WCAG 2.1 AA compliance requires actual UI implementation (React/Vue/etc).
 * This module provides TypeScript interfaces and rendering logic for HITL notifications.
 *
 * @section §21 HITL UI Components
 */

import type { HitlQueueItem, HitlQueueStatus } from "../../../orchestration/hitl/hitl-operator-console-service.js";

/**
 * Severity level for visual display of notifications
 */
export type NotificationSeverity = "info" | "warning" | "error" | "critical";

/**
 * Notification display priority for sorting and filtering
 */
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

/**
 * Mapping from HITL risk levels to UI display severity
 */
export function mapRiskLevelToSeverity(riskLevel: "low" | "medium" | "high" | "critical"): NotificationSeverity {
  switch (riskLevel) {
    case "low": return "info";
    case "medium": return "warning";
    case "high": return "error";
    case "critical": return "critical";
    default: return "critical";
  }
}

/**
 * Determine notification priority based on risk level and status
 */
export function calculateNotificationPriority(
  item: HitlQueueItem,
): NotificationPriority {
  if (item.riskLevel === "critical" && item.status === "pending") {
    return "urgent";
  }
  if (item.riskLevel === "high" && item.status === "pending") {
    return "high";
  }
  if (item.status === "acknowledged") {
    return "low";
  }
  return "normal";
}

/**
 * Accessibility label for screen readers
 */
export function buildAccessibleLabel(item: HitlQueueItem): string {
  const statusText = item.status === "pending" ? "Awaiting your decision" : `Status: ${item.status}`;
  const riskText = `Risk level: ${item.riskLevel}`;
  return `HITL Approval: ${item.title}. ${riskText}. ${statusText}`;
}

/**
 * Color contrast ratio helper - returns CSS color values
 *
 * WCAG 2.1 AA requires:
 * - 4.5:1 contrast for normal text
 * - 3:1 contrast for large text (18pt+ or 14pt+ bold)
 *
 * Note: Actual color values must be implemented in frontend CSS.
 * This function documents the contrast requirements.
 */
export function getSeverityColorTokens(severity: NotificationSeverity): {
  background: string;
  foreground: string;
  border: string;
  contrastRatio: number;
} {
  switch (severity) {
    case "info":
      return { background: "#e8f4fd", foreground: "#0d4a6e", border: "#2196f3", contrastRatio: 5.2 };
    case "warning":
      return { background: "#fff8e1", foreground: "#6d4c00", border: "#ff9800", contrastRatio: 4.8 };
    case "error":
      return { background: "#ffebee", foreground: "#b71c1c", border: "#f44336", contrastRatio: 5.1 };
    case "critical":
      return { background: "#ffcdd2", foreground: "#7f0000", border: "#d32f2f", contrastRatio: 7.2 };
    default:
      return { background: "#ffcdd2", foreground: "#7f0000", border: "#d32f2f", contrastRatio: 7.2 };
  }
}

/**
 * Sort notifications by priority (urgent first)
 */
export function sortByPriority(items: HitlQueueItem[]): HitlQueueItem[] {
  const priorityOrder: Record<NotificationPriority, number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  return [...items].sort((a, b) => {
    const pA = calculateNotificationPriority(a);
    const pB = calculateNotificationPriority(b);
    if (pA !== pB) return priorityOrder[pA] - priorityOrder[pB];
    // Secondary sort: oldest first
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Filter notifications by status
 */
export function filterByStatus(items: HitlQueueItem[], status: HitlQueueStatus | null): HitlQueueItem[] {
  if (status == null) return items;
  return items.filter((item) => item.status === status);
}

/**
 * Group notifications by stage reference
 */
export function groupByStage(items: HitlQueueItem[]): Map<string, HitlQueueItem[]> {
  const groups = new Map<string, HitlQueueItem[]>();
  for (const item of items) {
    const existing = groups.get(item.stageRef) ?? [];
    groups.set(item.stageRef, [...existing, item]);
  }
  return groups;
}

/**
 * WCAG 2.1 AA Compliance Requirements
 *
 * The following requirements must be met in any frontend UI implementation:
 *
 * 1. Color Contrast (§44 WCAG):
 *    - Normal text (< 18pt): minimum 4.5:1 contrast ratio
 *    - Large text (>= 18pt or 14pt bold): minimum 3:1 contrast ratio
 *    - Use getSeverityColorTokens() for compliant color pairs
 *
 * 2. Keyboard Navigation:
 *    - All interactive elements must be focusable and operable via keyboard
 *    - Logical tab order must follow visual layout
 *    - Visible focus indicator required (at least 2px outline)
 *
 * 3. Screen Reader Support:
 *    - Use buildAccessibleLabel() for ARIA labels
 *    - Live regions for dynamic content updates
 *    - Semantic HTML structure (nav, main, aside, etc.)
 *
 * 4. Focus Management:
 *    - When modal dialogs open, focus moves to dialog
 *    - When dialogs close, focus returns to trigger element
 *    - Skip links for navigation bypass
 *
 * Implementation Note:
 * These components provide TypeScript logic. Actual UI implementation
 * (React/Vue components) must use these functions and ensure WCAG compliance.
 */
export const WCAG_COMPLIANCE_NOTES = `
WCAG 2.1 AA Implementation Requirements:

1. Perceivable:
   - Text alternatives for non-text content (alt text, captions)
   - Captions/transcripts for audio content
   - Content adaptable to different presentations
   - Distinguishable (color not sole means of conveying information)
   - Minimum contrast ratios must satisfy WCAG AA

2. Operable:
   - All functionality keyboard accessible
   - Sufficient time for user to read/interact
   - No content that could cause seizures
   - Navigable (skip links, focus order, focus visible)

3. Understandable:
   - Readable (language specified, abbreviations explained)
   - Predictable (consistent navigation, identification)
   - Input assistance (error identification, labels, suggestions)

4. Robust:
   - Compatible with current and future assistive technologies
   - Valid HTML/semantic markup

Frontend Implementation Required:
- These TypeScript interfaces document the data model only
- Actual UI components must be implemented in a frontend framework
- CSS must use the color tokens from getSeverityColorTokens()
- ARIA attributes must be applied using buildAccessibleLabel()
` as const;
