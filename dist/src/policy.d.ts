import type { ScanResult } from './types.js';
export interface OpaRunResult {
    code: number | null;
    stdout: string;
    stderr: string;
    notFound?: boolean;
}
export type RunOpa = (args: string[], stdin: string, cwd: string) => Promise<OpaRunResult>;
export declare function resolveOpaPath(env?: NodeJS.ProcessEnv, cwd?: string): string | null;
export declare function assertOpaAvailable(run?: RunOpa): Promise<void>;
export declare function evaluatePolicy(result: ScanResult, policyPath: string, run?: RunOpa): Promise<string[]>;
//# sourceMappingURL=policy.d.ts.map