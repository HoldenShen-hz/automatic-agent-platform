import {
  ResponsibilityBoundaryService,
  type ResponsibilityBoundary,
  type ResponsibilityTransfer,
  type AccountabilityRecord,
} from "./types/responsibility-boundary.js";

let globalResponsibilityBoundaryService: ResponsibilityBoundaryService | null = null;

export type {
  ResponsibilityBoundary,
  ResponsibilityTransfer,
  AccountabilityRecord,
};

export function getResponsibilityBoundaryService(): ResponsibilityBoundaryService {
  if (globalResponsibilityBoundaryService == null) {
    globalResponsibilityBoundaryService = new ResponsibilityBoundaryService();
  }
  return globalResponsibilityBoundaryService;
}

export function resetResponsibilityBoundaryService(): void {
  globalResponsibilityBoundaryService = null;
}
