export declare function estimateSpeechDurationMs(sampleCount: number, sampleRate: number): number;
export interface SpeechAnalysisResult {
    readonly durationMs: number;
    readonly estimatedWords: number;
    readonly transcriptHint: string;
}
export declare function analyzeSpeech(sampleCount: number, sampleRate: number): SpeechAnalysisResult;
