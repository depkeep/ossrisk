export type Ecosystem = 'npm' | 'pypi' | 'maven' | 'cargo' | 'go';
export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export interface Dependency {
    name: string;
    version: string;
    ecosystem: Ecosystem;
}
export interface CveSignal {
    type: 'cve';
    id: string;
    severity: RiskLevel;
    summary: string;
}
export interface EolSignal {
    type: 'eol';
    cycle: string;
    eolDate: string;
}
export interface AbandonedSignal {
    type: 'abandoned';
    lastReleaseDate: string;
    monthsSince: number;
}
export interface StaleSignal {
    type: 'stale';
    lastReleaseDate: string;
    monthsSince: number;
}
export interface OutdatedSignal {
    type: 'outdated';
    latestVersion: string;
}
export interface TyposquatSignal {
    type: 'typosquat';
    suspectedTarget: string;
    reason: 'edit-distance' | 'homoglyph';
    distance: number;
}
export type RiskSignal = CveSignal | EolSignal | AbandonedSignal | StaleSignal | OutdatedSignal | TyposquatSignal;
export interface DependencyResult {
    name: string;
    version: string;
    ecosystem: Ecosystem;
    riskLevel: RiskLevel;
    signals: RiskSignal[];
}
export interface ScanSummary {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    clean: number;
}
export interface ScanResult {
    scannedAt: string;
    manifest: string;
    results: DependencyResult[];
    summary: ScanSummary;
}
export interface ScanOptions {
    path: string;
    format: 'table' | 'json' | 'markdown';
    failOn: RiskLevel | 'none';
    concurrency: number;
    noEol: boolean;
    noCve: boolean;
    noActivity: boolean;
    noOutdated: boolean;
    noTyposquat: boolean;
}
//# sourceMappingURL=types.d.ts.map