/**
 * Drift detection using multiple canonical detection windows per §63.2.
 * Implements Z-Score (1h), CUSUM (7d), Bayesian (30d), and KL-JS (90d) methods.
 */

export type DriftWindowType = "1h_zscore" | "7d_cusum" | "30d_bayesian" | "90d_kljs";

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
  severity: "low" | "medium" | "high" | "none";
  recommendedAction: "observe" | "require_review" | "pause_agent" | "none";
}

/** §63.2: 1h Z-Score window - detects rapid shifts using standard deviation */
const ZSCORE_WINDOW_HOURS = 1;

/** §63.2: 7d CUSUM window - cumulative sum for gradual drifts */
const CUSUM_WINDOW_HOURS = 7 * 24;

/** §63.2: 30d Bayesian window - probabilistic drift detection */
const BAYESIAN_WINDOW_HOURS = 30 * 24;

/** §63.2: 90d KL-JS window - distribution divergence detection */
const KLJS_WINDOW_HOURS = 90 * 24;

const ALL_WINDOWS: DriftWindowType[] = ["1h_zscore", "7d_cusum", "30d_bayesian", "90d_kljs"];

export class ChangepointDetectorService {
  /**
   * Detects changepoints using multiple canonical detection windows per §63.2.
   *
   * @param samples Time-ordered drift samples (oldest first)
   * @param windowType Which detection window to use (default all 4 windows)
   * @returns ChangepointDetectionResult with severity if drift detected
   */
  public detect(
    samples: DriftSample[],
    windowType: DriftWindowType = "1h_zscore",
  ): ChangepointDetectionResult {
    const samplesPerHour = 1; // Assuming 1 sample per hour
    const windowHours = this.getWindowHours(windowType);
    const windowSamples = windowHours * samplesPerHour;

    if (samples.length < windowSamples) {
      return {
        detected: false,
        baselineMean: 0,
        recentMean: 0,
        absoluteShift: 0,
        relativeShift: 0,
        reasonCode: `drift.insufficient_data:${windowType}`,
        severity: "none",
        recommendedAction: "none",
      };
    }

    switch (windowType) {
      case "1h_zscore":
        return this.detectZScore(samples, windowSamples);
      case "7d_cusum":
        return this.detectCUSUM(samples, windowSamples);
      case "30d_bayesian":
        return this.detectBayesian(samples, windowSamples);
      case "90d_kljs":
        return this.detectKLJS(samples, windowSamples);
    }
  }

  /**
   * Returns all 4 canonical detection window results per §63.2.
   */
  public detectAll(samples: DriftSample[]): ChangepointDetectionResult[] {
    return ALL_WINDOWS.map((windowType) => this.detect(samples, windowType));
  }

  private getWindowHours(windowType: DriftWindowType): number {
    switch (windowType) {
      case "1h_zscore":
        return ZSCORE_WINDOW_HOURS;
      case "7d_cusum":
        return CUSUM_WINDOW_HOURS;
      case "30d_bayesian":
        return BAYESIAN_WINDOW_HOURS;
      case "90d_kljs":
        return KLJS_WINDOW_HOURS;
    }
  }

  /**
   * 1h Z-Score: Detects rapid shifts using standard deviation from baseline mean.
   * Triggers SEV3+ when score deviates beyond threshold from baseline.
   */
  private detectZScore(
    samples: DriftSample[],
    windowSamples: number,
  ): ChangepointDetectionResult {
    const baseline = samples.slice(0, windowSamples);
    const recent = samples.slice(-1); // Compare latest point to baseline

    const baselineMean = average(baseline.map((s) => s.score));
    const baselineStd = standardDeviation(baseline.map((s) => s.score));
    const recentScore = recent[0]!.score;

    const zScore = baselineStd !== 0 ? (recentScore - baselineMean) / baselineStd : 0;
    const detected = Math.abs(zScore) > 2; // |Z| > 2 indicates significant drift

    const severity = this.zScoreToSeverity(zScore);
    return {
      detected,
      baselineMean,
      recentMean: recentScore,
      absoluteShift: recentScore - baselineMean,
      relativeShift: baselineMean !== 0 ? (recentScore - baselineMean) / baselineMean : 0,
      reasonCode: detected ? "drift.zscore_detected" : "drift.stable",
      severity,
      recommendedAction: severityToAction(severity),
    };
  }

  /**
   * 7d CUSUM: Cumulative sum detection for gradual drifts.
   * Detects sustained drift direction over the window.
   */
  private detectCUSUM(
    samples: DriftSample[],
    windowSamples: number,
  ): ChangepointDetectionResult {
    const baseline = samples.slice(0, windowSamples);
    const recent = samples.slice(-Math.min(windowSamples, 24)); // Last 24h for comparison

    const baselineMean = average(baseline.map((s) => s.score));
    const target = baselineMean;
    const k = 0.5 * standardDeviation(baseline.map((s) => s.score)); // Allowable slack

    let cusumPos = 0;
    let cusumNeg = 0;

    for (const sample of recent) {
      const dev = sample.score - target;
      cusumPos = Math.max(0, cusumPos + dev - k);
      cusumNeg = Math.max(0, cusumNeg - dev - k);
    }

    const h = 5 * baselineMean; // Decision boundary
    const detected = cusumPos > h || cusumNeg > h;

    const severity = this.cusumToSeverity(cusumPos, cusumNeg, h);
    return {
      detected,
      baselineMean,
      recentMean: average(recent.map((s) => s.score)),
      absoluteShift: average(recent.map((s) => s.score)) - baselineMean,
      relativeShift: baselineMean !== 0 ? (average(recent.map((s) => s.score)) - baselineMean) / baselineMean : 0,
      reasonCode: detected ? "drift.cusum_detected" : "drift.stable",
      severity,
      recommendedAction: severityToAction(severity),
    };
  }

  /**
   * 30d Bayesian: Probabilistic drift detection.
   * Compares posterior probability of drift vs no-drift.
   */
  private detectBayesian(
    samples: DriftSample[],
    windowSamples: number,
  ): ChangepointDetectionResult {
    const baseline = samples.slice(0, windowSamples);
    const recent = samples.slice(-Math.min(windowSamples, 24));

    const baselineMean = average(baseline.map((s) => s.score));
    const recentMean = average(recent.map((s) => s.score));
    const baselineVar = variance(baseline.map((s) => s.score));
    const recentVar = variance(recent.map((s) => s.score));

    // Simple Bayesian comparison: compute probability that recent mean differs from baseline
    const pooledVar = (baselineVar + recentVar) / 2;
    const se = Math.sqrt(pooledVar / recent.length);
    const tStat = se !== 0 ? Math.abs(recentMean - baselineMean) / se : 0;

    // P(|t| > tStat) approximation using normal distribution
    const pValue = 2 * (1 - normalCDF(tStat));
    const detected = pValue < 0.05; // 95% confidence threshold

    const severity = this.bayesianToSeverity(pValue);
    return {
      detected,
      baselineMean,
      recentMean,
      absoluteShift: recentMean - baselineMean,
      relativeShift: baselineMean !== 0 ? (recentMean - baselineMean) / baselineMean : 0,
      reasonCode: detected ? "drift.bayesian_detected" : "drift.stable",
      severity,
      recommendedAction: severityToAction(severity),
    };
  }

  /**
   * 90d KL-JS: Distribution divergence detection using Jensen-Shannon divergence.
   * Compares probability distributions of baseline vs recent window.
   */
  private detectKLJS(
    samples: DriftSample[],
    windowSamples: number,
  ): ChangepointDetectionResult {
    const baseline = samples.slice(0, windowSamples);
    const recent = samples.slice(-Math.min(windowSamples, 24));

    const baselineScores = baseline.map((s) => s.score);
    const recentScores = recent.map((s) => s.score);

    const divergence = this.jensenShannonDivergence(baselineScores, recentScores);
    // JS divergence threshold: > 0.1 indicates significant distributional shift
    const detected = divergence > 0.1;

    const severity = this.kljsToSeverity(divergence);
    return {
      detected,
      baselineMean: average(baselineScores),
      recentMean: average(recentScores),
      absoluteShift: average(recentScores) - average(baselineScores),
      relativeShift: average(baselineScores) !== 0
        ? (average(recentScores) - average(baselineScores)) / average(baselineScores)
        : 0,
      reasonCode: detected ? "drift.kljs_detected" : "drift.stable",
      severity,
      recommendedAction: severityToAction(severity),
    };
  }

  private jensenShannonDivergence(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;

    // Bin the scores into discrete distributions
    const allScores = [...a, ...b];
    const min = Math.min(...allScores);
    const max = Math.max(...allScores);
    const bins = 10;
    const binWidth = (max - min) / bins || 1;

    const histA = new Array(bins).fill(0);
    const histB = new Array(bins).fill(0);

    for (const v of a) {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histA[idx]++;
    }
    for (const v of b) {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histB[idx]++;
    }

    // Normalize to probability distributions
    const norm = (arr: number[]) => {
      const sum = arr.reduce((s, v) => s + v, 0);
      return sum > 0 ? arr.map((v) => v / sum) : arr;
    };
    const p = norm(histA);
    const q = norm(histB);

    // Compute KL divergence P||M and Q||M where M = (P+Q)/2
    const m = p.map((vi, i) => (vi + q[i]) / 2);
    const klPM = p.reduce((sum, pi, i) => sum + (pi > 0 && m[i] > 0 ? pi * Math.log(pi / m[i]) : 0), 0);
    const klQM = q.reduce((sum, qi, i) => sum + (qi > 0 && m[i] > 0 ? qi * Math.log(qi / m[i]) : 0), 0);

    return (klPM + klQM) / 2;
  }

  private zScoreToSeverity(zScore: number): ChangepointDetectionResult["severity"] {
    if (Math.abs(zScore) > 4) return "high";
    if (Math.abs(zScore) > 3) return "medium";
    if (Math.abs(zScore) > 2) return "low";
    return "none";
  }

  private cusumToSeverity(
    cusumPos: number,
    cusumNeg: number,
    h: number,
  ): ChangepointDetectionResult["severity"] {
    const maxCusum = Math.max(cusumPos, cusumNeg);
    if (maxCusum > 3 * h) return "high";
    if (maxCusum > 2 * h) return "medium";
    if (maxCusum > h) return "low";
    return "none";
  }

  private bayesianToSeverity(pValue: number): ChangepointDetectionResult["severity"] {
    if (pValue < 0.01) return "high";
    if (pValue < 0.03) return "medium";
    if (pValue < 0.05) return "low";
    return "none";
  }

  private kljsToSeverity(divergence: number): ChangepointDetectionResult["severity"] {
    if (divergence > 0.3) return "high";
    if (divergence > 0.2) return "medium";
    if (divergence > 0.1) return "low";
    return "none";
  }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

function normalCDF(x: number): number {
  // Approximation of standard normal CDF
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function severityToAction(
  severity: ChangepointDetectionResult["severity"],
): ChangepointDetectionResult["recommendedAction"] {
  switch (severity) {
    case "high":
      return "pause_agent";
    case "medium":
      return "require_review";
    case "low":
      return "observe";
    case "none":
      return "none";
  }
}
