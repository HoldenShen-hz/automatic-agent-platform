/**
 * Drift detection thresholds: 24-hour sliding window with -10% relative change.
 * Emits SEV3 event when drift is detected.
 */
export interface DriftSample {
    observedAt: string;
    score: number;
}
export interface ChangepointDetectionResult {
    detected: boolean;
    baselineMean: number;
    recentMean: number;
    absoluteShift: number;
    relativeShift: number;
    reasonCode: string;
    severity: "SEV3" | "none";
}
export declare class ChangepointDetectorService {
    /**
     * Detects changepoints using 24h sliding window and -10% relative threshold.
     *
     * @param samples Time-ordered drift samples (oldest first)
     * @param baselineWindow Number of samples for baseline (default 24 for 24h)
     * @param recentWindow Number of samples for recent window (default 3)
     * @returns ChangepointDetectionResult with SEV3 severity if drift detected
     */
    detect(samples: DriftSample[], baselineWindow?: number, recentWindow?: number): ChangepointDetectionResult;
}
