export interface ScimDlqRecord {
  readonly recordId: string;
  readonly identityId: string;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly lastError: string;
}

export interface ScimDlqReconciliationReport {
  readonly reportId: string;
  readonly retryRecordIds: readonly string[];
  readonly exhaustedRecordIds: readonly string[];
  readonly unresolvedIdentityIds: readonly string[];
}

export class ScimDlqReconciliationService {
  public reconcile(reportId: string, records: readonly ScimDlqRecord[]): ScimDlqReconciliationReport {
    return {
      reportId,
      retryRecordIds: records
        .filter((record) => record.retryCount < record.maxRetries)
        .map((record) => record.recordId),
      exhaustedRecordIds: records
        .filter((record) => record.retryCount >= record.maxRetries)
        .map((record) => record.recordId),
      unresolvedIdentityIds: records
        .filter((record) => record.retryCount >= record.maxRetries)
        .map((record) => record.identityId),
    };
  }
}
