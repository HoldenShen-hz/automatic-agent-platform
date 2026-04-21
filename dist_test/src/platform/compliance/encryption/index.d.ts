export interface FieldProtectionRule {
    fieldPath: string;
    classification: "internal" | "confidential" | "restricted";
}
export interface ProtectedField {
    fieldPath: string;
    ciphertext: string;
    keyRef: string;
    classification: FieldProtectionRule["classification"];
}
export interface FieldProtectionResult {
    protectedRecord: Record<string, unknown>;
    protectedFields: ProtectedField[];
}
export declare class FieldEncryptionService {
    protectRecord(input: {
        record: Record<string, unknown>;
        rules: FieldProtectionRule[];
        keyRef: string;
    }): FieldProtectionResult;
    revealField(input: {
        ciphertext: string;
        keyRef: string;
    }): string;
}
