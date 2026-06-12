import { existsSync } from 'fs';
import { join } from 'path';
import type {
  CveSignal,
  Dependency,
  DependencyResult,
  ProgressCallback,
  RiskLevel,
  RiskSignal,
  ScanOptions,
  ScanResult,
} from './types.js';
import { checkCvesBatch } from './checkers/osv.js';
import { checkActivity } from './checkers/activity.js';
import { checkEol } from './checkers/eol.js';
import { checkOutdated } from './checkers/outdated.js';
import { checkTyposquat } from './checkers/typosquat.js';
import { checkLicense } from './checkers/license.js';
import { checkMaintainer } from './checkers/maintainer.js';
import { checkInstallScript } from './checkers/install-script.js';
import { parseNpm } from './parsers/npm.js';
import { parsePython } from './parsers/python.js';

const RISK_ORDER: RiskLevel[] = ['none', 'low', 'medium', 'high', 'critical'];

function signalRisk(s: RiskSignal): RiskLevel {
  switch (s.type) {
    case 'cve':        return s.severity;
    case 'eol':        return 'high';
    case 'typosquat':  return 'high';
    case 'license':    return s.category === 'strong-copyleft' ? 'medium' : 'low';
    case 'maintainer':      return s.pattern === 'new-publisher' ? 'medium' : 'low';
    case 'install-script':   return 'low';
    case 'abandoned':  return 'medium';
    case 'stale':      return 'low';
    case 'outdated':   return 'low';
  }
}

function maxRisk(signals: RiskSignal[]): RiskLevel {
  return signals.reduce<RiskLevel>((max, s) => {
    const level = signalRisk(s);
    return RISK_ORDER.indexOf(level) > RISK_ORDER.indexOf(max) ? level : max;
  }, 'none');
}

async function detectAndParse(dir: string): Promise<{ deps: Dependency[]; manifest: string }> {
  if (existsSync(join(dir, 'package.json'))) {
    const deps = await parseNpm(dir);
    return { deps, manifest: join(dir, 'package.json') };
  }
  if (existsSync(join(dir, 'Pipfile.lock'))) {
    const deps = await parsePython(dir);
    return { deps, manifest: join(dir, 'Pipfile.lock') };
  }
  if (existsSync(join(dir, 'requirements.txt'))) {
    const deps = await parsePython(dir);
    return { deps, manifest: join(dir, 'requirements.txt') };
  }
  throw new Error(
    'No supported manifest found. Supported: package.json, Pipfile.lock, requirements.txt'
  );
}

export async function scan(
  opts: ScanOptions,
  onProgress?: ProgressCallback
): Promise<ScanResult> {
  const all = await detectAndParse(opts.path);
  const manifest = all.manifest;
  const deps = opts.directOnly ? all.deps.filter(d => d.isDirect) : all.deps;

  // CVEs: one batched API call for all deps
  if (!opts.noCve) {
    onProgress?.({ phase: 'cve', completed: 0, total: deps.length });
  }
  const cveMap = opts.noCve
    ? new Map<string, CveSignal[]>()
    : await checkCvesBatch(deps);

  // EOL + activity: per-dep, run concurrently in controlled batches
  const results: DependencyResult[] = [];
  let completed = 0;

  for (let i = 0; i < deps.length; i += opts.concurrency) {
    const batch = deps.slice(i, i + opts.concurrency);
    const batchResults = await Promise.all(
      batch.map(async (dep): Promise<DependencyResult> => {
        const signals: RiskSignal[] = [
          ...(cveMap.get(`${dep.name}@${dep.version}`) ?? []),
          ...(!opts.noEol        ? await checkEol(dep)        : []),
          ...(!opts.noActivity   ? await checkActivity(dep)   : []),
          ...(!opts.noOutdated   ? await checkOutdated(dep)   : []),
          ...(!opts.noLicense    ? await checkLicense(dep)    : []),
          ...(!opts.noMaintainer    ? await checkMaintainer(dep)    : []),
          ...(!opts.noInstallScript ? await checkInstallScript(dep) : []),
          ...(!opts.noTyposquat     ? checkTyposquat(dep)           : []),
        ];
        completed++;
        onProgress?.({
          phase: 'checks',
          completed,
          total: deps.length,
          current: `${dep.name}@${dep.version}`,
        });
        return {
          name: dep.name,
          version: dep.version,
          ecosystem: dep.ecosystem,
          riskLevel: maxRisk(signals),
          signals,
          isDirect: dep.isDirect,
          via: dep.via,
        };
      })
    );
    results.push(...batchResults);
  }

  onProgress?.({ phase: 'done', completed: deps.length, total: deps.length });

  results.sort(
    (a, b) => RISK_ORDER.indexOf(b.riskLevel) - RISK_ORDER.indexOf(a.riskLevel)
  );

  const summary = {
    total:    results.length,
    critical: results.filter(r => r.riskLevel === 'critical').length,
    high:     results.filter(r => r.riskLevel === 'high').length,
    medium:   results.filter(r => r.riskLevel === 'medium').length,
    low:      results.filter(r => r.riskLevel === 'low').length,
    clean:    results.filter(r => r.riskLevel === 'none').length,
  };

  return { scannedAt: new Date().toISOString(), manifest, results, summary };
}
