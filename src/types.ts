export type Ecosystem = 'npm' | 'pypi' | 'maven' | 'cargo' | 'go';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface Dependency {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  isDirect: boolean;
  // Name of a top-level (direct) dependency through which this transitive
  // is pulled in. Undefined for direct deps and for transitives whose path
  // back to a direct dep can't be resolved from the available metadata.
  via?: string;
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

export type LicenseCategory =
  | 'permissive'
  | 'weak-copyleft'
  | 'strong-copyleft'
  | 'unknown';

export interface LicenseSignal {
  type: 'license';
  license: string;
  category: Exclude<LicenseCategory, 'permissive'>;
}

export interface MaintainerSignal {
  type: 'maintainer';
  pattern: 'new-publisher' | 'sole-maintainer';
  detail: string;
}

export interface InstallScriptSignal {
  type: 'install-script';
  hooks: string[];
}

export type RiskSignal =
  | CveSignal
  | EolSignal
  | AbandonedSignal
  | StaleSignal
  | OutdatedSignal
  | TyposquatSignal
  | LicenseSignal
  | MaintainerSignal
  | InstallScriptSignal;

export interface DependencyResult {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  isDirect: boolean;
  via?: string;
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

export interface ScanProgressEvent {
  // 'cve' fires once before the batched OSV query; 'checks' fires as each
  // dependency finishes its per-dep checkers; 'done' fires once at the end.
  phase: 'cve' | 'checks' | 'done';
  completed: number;
  total: number;
  // "name@version" of the dependency that just completed (checks phase only).
  current?: string;
}

export type ProgressCallback = (event: ScanProgressEvent) => void;

export type OutputFormat = 'table' | 'json' | 'markdown' | 'cyclonedx' | 'spdx';

export interface ScanOptions {
  path: string;
  format: OutputFormat;
  failOn: RiskLevel | 'none';
  // Path to an OPA Rego policy file or directory. When set, scan results are
  // evaluated against data.ossrisk.deny and any violation fails the scan.
  policy?: string;
  concurrency: number;
  noEol: boolean;
  noCve: boolean;
  noActivity: boolean;
  noOutdated: boolean;
  noTyposquat: boolean;
  noLicense: boolean;
  noMaintainer: boolean;
  noInstallScript: boolean;
  directOnly: boolean;
}
