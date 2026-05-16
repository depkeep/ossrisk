const OSV_BATCH_API = 'https://api.osv.dev/v1/querybatch';
const BATCH_SIZE = 100;
const ECOSYSTEM_MAP = {
    npm: 'npm',
    pypi: 'PyPI',
    maven: 'Maven',
    cargo: 'crates.io',
    go: 'Go',
};
function cvssToLevel(score) {
    const n = parseFloat(score);
    if (n >= 9.0)
        return 'critical';
    if (n >= 7.0)
        return 'high';
    if (n >= 4.0)
        return 'medium';
    return 'low';
}
function vulnSeverity(v) {
    for (const s of v.severity ?? []) {
        if (s.type === 'CVSS_V3' || s.type === 'CVSS_V2')
            return cvssToLevel(s.score);
    }
    const ds = v.database_specific?.severity?.toUpperCase();
    if (ds === 'CRITICAL')
        return 'critical';
    if (ds === 'HIGH')
        return 'high';
    if (ds === 'MODERATE' || ds === 'MEDIUM')
        return 'medium';
    if (ds === 'LOW')
        return 'low';
    return 'medium';
}
export async function checkCvesBatch(deps) {
    const results = new Map();
    for (let i = 0; i < deps.length; i += BATCH_SIZE) {
        const batch = deps.slice(i, i + BATCH_SIZE);
        try {
            const res = await fetch(OSV_BATCH_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    queries: batch.map(d => ({
                        version: d.version,
                        package: { name: d.name, ecosystem: ECOSYSTEM_MAP[d.ecosystem] ?? d.ecosystem },
                    })),
                }),
            });
            if (!res.ok)
                continue;
            const data = await res.json();
            for (let j = 0; j < batch.length; j++) {
                const dep = batch[j];
                const vulns = data.results[j]?.vulns ?? [];
                results.set(`${dep.name}@${dep.version}`, vulns.map(v => ({
                    type: 'cve',
                    id: v.id,
                    severity: vulnSeverity(v),
                    summary: v.summary ?? 'No description available',
                })));
            }
        }
        catch {
            // Network errors: skip batch, leave entries absent (treated as no CVEs)
        }
    }
    return results;
}
//# sourceMappingURL=osv.js.map