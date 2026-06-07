// npm lifecycle hooks that run automatically during `npm install`.
// Any of these present in a package's scripts are a supply-chain attack
// surface: they execute arbitrary code on the installing machine without
// explicit user confirmation.
const INSTALL_HOOKS = ['preinstall', 'install', 'postinstall'];
async function fetchManifest(name, version) {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok)
        return null;
    return res.json();
}
export async function checkInstallScript(dep) {
    // Only npm packages have install lifecycle hooks.
    if (dep.ecosystem !== 'npm')
        return [];
    try {
        const manifest = await fetchManifest(dep.name, dep.version);
        if (!manifest)
            return [];
        const scripts = manifest.scripts ?? {};
        const hooks = INSTALL_HOOKS.filter(hook => typeof scripts[hook] === 'string');
        if (hooks.length === 0)
            return [];
        return [{ type: 'install-script', hooks }];
    }
    catch {
        // Registry unreachable — not a failure condition
    }
    return [];
}
//# sourceMappingURL=install-script.js.map