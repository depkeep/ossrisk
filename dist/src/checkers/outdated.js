async function latestNpmVersion(name) {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, { headers: { Accept: 'application/json' } });
    if (!res.ok)
        return null;
    const data = await res.json();
    return data.version ?? null;
}
async function latestPypiVersion(name) {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
    if (!res.ok)
        return null;
    const data = await res.json();
    return data.info?.version ?? null;
}
export async function checkOutdated(dep) {
    try {
        let latest = null;
        if (dep.ecosystem === 'npm') {
            latest = await latestNpmVersion(dep.name);
        }
        else if (dep.ecosystem === 'pypi') {
            latest = await latestPypiVersion(dep.name);
        }
        if (!latest || latest === dep.version)
            return [];
        return [{ type: 'outdated', latestVersion: latest }];
    }
    catch {
        // Registry unreachable — not a failure condition
    }
    return [];
}
//# sourceMappingURL=outdated.js.map