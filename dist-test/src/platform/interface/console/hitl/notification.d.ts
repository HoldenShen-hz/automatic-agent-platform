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
export declare function mapRiskLevelToSeverity(riskLevel: "low" | "medium" | "high" | "critical"): NotificationSeverity;
/**
 * Determine notification priority based on risk level and status
 */
export declare function calculateNotificationPriority(item: HitlQueueItem): NotificationPriority;
/**
 * Accessibility label for screen readers
 */
export declare function buildAccessibleLabel(item: HitlQueueItem): string;
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
export declare function getSeverityColorTokens(severity: NotificationSeverity): {
    background: string;
    foreground: string;
    border: string;
    contrastRatio: number;
};
/**
 * Sort notifications by priority (urgent first)
 */
export declare function sortByPriority(items: HitlQueueItem[]): HitlQueueItem[];
/**
 * Filter notifications by status
 */
export declare function filterByStatus(items: HitlQueueItem[], status: HitlQueueStatus | null): HitlQueueItem[];
/**
 * Group notifications by stage reference
 */
export declare function groupByStage(items: HitlQueueItem[]): Map<string, HitlQueueItem[]>;
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
export declare const WCAG_COMPLIANCE_NOTES: "\nWCAG 2.1 AA Implementation Requirements:\n\n1. Perceivable:\n   - Text alternatives for non-text content (alt text, captions)\n   - Captions/transcripts for audio content\n   - Content adaptable to different presentations\n   - Distinguishable (color not sole means of conveying information)\n   - Minimum contrast ratios must satisfy WCAG AA\n\n2. Operable:\n   - All functionality keyboard accessible\n   - Sufficient time for user to read/interact\n   - No content that could cause seizures\n   - Navigable (skip links, focus order, focus visible)\n\n3. Understandable:\n   - Readable (language specified, abbreviations explained)\n   - Predictable (consistent navigation, identification)\n   - Input assistance (error identification, labels, suggestions)\n\n4. Robust:\n   - Compatible with current and future assistive technologies\n   - Valid HTML/semantic markup\n\nFrontend Implementation Required:\n- These TypeScript interfaces document the data model only\n- Actual UI components must be implemented in a frontend framework\n- CSS must use the color tokens from getSeverityColorTokens()\n- ARIA attributes must be applied using buildAccessibleLabel()\n";
