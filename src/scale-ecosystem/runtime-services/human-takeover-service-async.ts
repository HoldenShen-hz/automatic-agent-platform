import {
  HumanTakeoverServiceAsync as PlatformHumanTakeoverServiceAsync,
} from "../../platform/five-plane-control-plane/incident-control/human-takeover-service-async.js";
import type {
  HumanTakeoverService,
  TakeoverActionResult,
} from "../../platform/five-plane-control-plane/incident-control/human-takeover-service.js";

export type { TakeoverActionResult } from "../../platform/five-plane-control-plane/incident-control/human-takeover-service.js";

type TakeoverOperationType =
  | "openSession"
  | "modifyInput"
  | "switchWorker"
  | "retryExecution"
  | "setCurrentStep"
  | "writeStepOutput"
  | "skipCurrentStep"
  | "completeTask";

export interface HumanTakeoverServiceAsyncMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  operationsByType: Record<TakeoverOperationType, number>;
}

const INITIAL_METRICS = (): HumanTakeoverServiceAsyncMetrics => ({
  totalOperations: 0,
  successfulOperations: 0,
  failedOperations: 0,
  operationsByType: {
    openSession: 0,
    modifyInput: 0,
    switchWorker: 0,
    retryExecution: 0,
    setCurrentStep: 0,
    writeStepOutput: 0,
    skipCurrentStep: 0,
    completeTask: 0,
  },
});

export class HumanTakeoverServiceAsync extends PlatformHumanTakeoverServiceAsync {
  private metrics: HumanTakeoverServiceAsyncMetrics = INITIAL_METRICS();

  public async openSession(
    input: Parameters<HumanTakeoverService["openSession"]>[0],
  ): Promise<TakeoverActionResult> {
    return this.runOperation("openSession", (sync) => sync.openSession(input));
  }

  public async modifyInput(
    input: Parameters<HumanTakeoverService["modifyInput"]>[0],
  ): Promise<TakeoverActionResult> {
    return this.runOperation("modifyInput", (sync) => sync.modifyInput(input));
  }

  public async switchWorker(
    input: Parameters<HumanTakeoverService["switchWorker"]>[0],
  ): Promise<TakeoverActionResult> {
    return this.runOperation("switchWorker", (sync) => sync.switchWorker(input));
  }

  public async retryExecution(
    input: Parameters<HumanTakeoverService["retryExecution"]>[0],
  ): Promise<TakeoverActionResult> {
    return this.runOperation("retryExecution", (sync) => sync.retryExecution(input));
  }

  public async setCurrentStep(
    input: Parameters<HumanTakeoverService["setCurrentStep"]>[0],
  ): Promise<TakeoverActionResult> {
    return this.runOperation("setCurrentStep", (sync) => sync.setCurrentStep(input));
  }

  public async writeStepOutput(
    input: Parameters<HumanTakeoverService["writeStepOutput"]>[0],
  ): Promise<TakeoverActionResult> {
    return this.runOperation("writeStepOutput", (sync) => sync.writeStepOutput(input));
  }

  public async skipCurrentStep(
    input: Parameters<HumanTakeoverService["skipCurrentStep"]>[0],
  ): Promise<TakeoverActionResult> {
    return this.runOperation("skipCurrentStep", (sync) => sync.skipCurrentStep(input));
  }

  public async completeTask(
    input: Parameters<HumanTakeoverService["completeTask"]>[0],
  ): Promise<TakeoverActionResult> {
    return this.runOperation("completeTask", (sync) => sync.completeTask(input));
  }

  public getMetrics(): HumanTakeoverServiceAsyncMetrics {
    return {
      totalOperations: this.metrics.totalOperations,
      successfulOperations: this.metrics.successfulOperations,
      failedOperations: this.metrics.failedOperations,
      operationsByType: { ...this.metrics.operationsByType },
    };
  }

  public resetMetrics(): void {
    this.metrics = INITIAL_METRICS();
  }

  public getActiveOperationCount(): number {
    return 0;
  }

  public dispose(): void {
    void this.stopProcessingLoop();
  }

  private async runOperation(
    operation: TakeoverOperationType,
    runner: (sync: HumanTakeoverService) => TakeoverActionResult,
  ): Promise<TakeoverActionResult> {
    this.metrics.totalOperations += 1;
    this.metrics.operationsByType[operation] += 1;
    try {
      const result = runner(this.getSyncService());
      this.metrics.successfulOperations += 1;
      return Promise.resolve(result);
    } catch (error) {
      this.metrics.failedOperations += 1;
      const rejected = Promise.reject(error) as Promise<TakeoverActionResult>;
      rejected.catch(() => undefined);
      return rejected;
    }
  }
}
