import {
  PlatformPanicService,
  type PanicActivationRequest,
  type PanicResumeReceipt,
  type PlatformPanicActivation,
} from "../../../ops-maturity/emergency/platform-panic-service.js";
import type { ResumePlan } from "../../../ops-maturity/emergency/resume-protocol/index.js";

export class AdminRuntimeDirectiveService {
  private readonly panicService = new PlatformPanicService();

  public issuePanicDirective(input: PanicActivationRequest): PlatformPanicActivation {
    return this.panicService.activate(input);
  }

  public submitResumeDirective(plan: ResumePlan): PanicResumeReceipt {
    return this.panicService.resume(plan.scope, plan);
  }

  public getActivePanicDirective(scope: string): PlatformPanicActivation | null {
    return this.panicService.getActive(scope);
  }
}
