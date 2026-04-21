export interface DriftSample {
    observedAt: string;
    score: number;
}
export interface ChangepointDetectionResult {
    detected: boolean;
    baselineMean: number;
    recentMean: number;
    absoluteShift: number;
    reasonCode: string;
}
export declare class ChangepointDetectorService {
    detect(samples: DriftSample[], baselineWindow?: number, recentWindow?: number): ChangepointDetectionResult;
}
