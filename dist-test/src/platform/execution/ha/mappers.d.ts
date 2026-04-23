import type { CoordinatorNode, FailoverDecision, LeaderLease, LeadershipEpoch, RawRow } from "./types.js";
export declare function mapNode(row: RawRow): CoordinatorNode;
export declare function mapLease(row: RawRow): LeaderLease;
export declare function mapEpoch(row: RawRow): LeadershipEpoch;
export declare function mapFailoverDecision(row: RawRow): FailoverDecision;
