import type { Ecosystem, ScanResult } from '../types.js';
export declare function toPurl(dep: {
    name: string;
    version: string;
    ecosystem: Ecosystem;
}): string;
export declare function renderCycloneDx(result: ScanResult, toolVersion: string): string;
export declare function renderSpdx(result: ScanResult, toolVersion: string): string;
//# sourceMappingURL=sbom.d.ts.map