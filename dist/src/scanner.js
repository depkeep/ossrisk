import { existsSync } from 'fs';
import { join } from 'path';
import { checkCvesBatch } from './checkers/osv.js';
import { checkActivity } from './checkers/activity.js';
import { checkEol } from './checkers/eol.js';
import { checkOutdated } from './checkers/outdated.js';
import { checkTyposquat } from './checkers/typosquat.js';
import { checkLicense } from './checkers/license.js';
import { checkMaintainer } from './checkers/maintainer.js';
import { parseNpm } from './parsers/npm.js';
import { parsePython } from './parsers/python.js';
const RISK_ORDER = ['none', 'low', 'medium', 'high', 'critical'];
function signalRisk(s) {
    switch (s.type) {
        case 'cve': return s.severity;
        case 'eol': return 'high';
        case 'typosquat': return 'high';
        case 'license': return s.category === 'strong-copyleft' ? 'medium' : 'low';
        case 'maintainer': return s.pattern === 'new-publisher' ? 'medium' : 'low';
        case 'abandoned': return 'medium';
        case 'stale': return 'low';
        case 'outdated': return 'low';
    }
}
function maxRisk(signals) {
    return signals.reduce((max, s) => {
        const level = signalRisk(s);
        return RISK_ORDER.indexOf(level) > RISK_ORDER.indexOf(max) ? level : max;
    }, 'none');
}
async function detectAndParse(dir) {
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
    throw new Error('No supported manifest found. Supported: package.json, Pipfile.lock, requirements.txt');
}
export async function scan(opts) {
    const all = await detectAndParse(opts.path);
    const manifest = all.manifest;
    const deps = opts.directOnly ? all.deps.filter(d => d.isDirect) : all.deps;
    // CVEs: one batched API call for all deps
    const cveMap = opts.noCve
        ? new Map()
        : await checkCvesBatch(deps);
    // EOL + activity: per-dep, run concurrently in controlled batches
    const results = [];
    for (let i = 0; i < deps.length; i += opts.concurrency) {
        const batch = deps.slice(i, i + opts.concurrency);
        const batchResults = await Promise.all(batch.map(async (dep) => {
            const signals = [
                ...(cveMap.get(`${dep.name}@${dep.version}`) ?? []),
                ...(!opts.noEol ? await checkEol(dep) : []),
                ...(!opts.noActivity ? await checkActivity(dep) : []),
                ...(!opts.noOutdated ? await checkOutdated(dep) : []),
                ...(!opts.noLicense ? await checkLicense(dep) : []),
                ...(!opts.noMaintainer ? await checkMaintainer(dep) : []),
                ...(!opts.noTyposquat ? checkTyposquat(dep) : []),
            ];
            return {
                name: dep.name,
                version: dep.version,
                ecosystem: dep.ecosystem,
                riskLevel: maxRisk(signals),
                signals,
                isDirect: dep.isDirect,
                via: dep.via,
            };
        }));
        results.push(...batchResults);
    }
    results.sort((a, b) => RISK_ORDER.indexOf(b.riskLevel) - RISK_ORDER.indexOf(a.riskLevel));
    const summary = {
        total: results.length,
        critical: results.filter(r => r.riskLevel === 'critical').length,
        high: results.filter(r => r.riskLevel === 'high').length,
        medium: results.filter(r => r.riskLevel === 'medium').length,
        low: results.filter(r => r.riskLevel === 'low').length,
        clean: results.filter(r => r.riskLevel === 'none').length,
    };
    return { scannedAt: new Date().toISOString(), manifest, results, summary };
}
//# sourceMappingURL=scanner.js.map