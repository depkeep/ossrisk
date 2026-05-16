// Maps package names → endoflife.date product slugs.
// Only packages/runtimes that have formal EOL policies are included.
const EOL_MAP = {
    // Runtimes
    'node': 'nodejs',
    'nodejs': 'nodejs',
    'python': 'python',
    'ruby': 'ruby',
    'php': 'php',
    'golang': 'go',
    // Frameworks
    'django': 'django',
    'rails': 'rails',
    'laravel': 'laravel',
    'symfony': 'symfony',
    'spring-boot': 'spring-boot',
    'angular': 'angular',
    '@angular/core': 'angular',
    'bootstrap': 'bootstrap',
    // Databases (client package name → server product)
    'pg': 'postgresql',
    'mysql': 'mysql',
    'mysql2': 'mysql',
    'mongodb': 'mongodb',
    // Others
    'wordpress': 'wordpress',
    'drupal': 'drupal',
    'magento': 'magento-2',
    'nextjs': 'nextjs',
    'next': 'nextjs',
    'nuxt': 'nuxtjs',
};
function candidateCycles(version) {
    const parts = version.split('.').filter(p => /^\d+$/.test(p));
    const cycles = [];
    if (parts.length >= 2)
        cycles.push(`${parts[0]}.${parts[1]}`);
    if (parts.length >= 1)
        cycles.push(parts[0]);
    return cycles;
}
export async function checkEol(dep) {
    const product = EOL_MAP[dep.name];
    if (!product)
        return [];
    try {
        const res = await fetch(`https://endoflife.date/api/${product}.json`);
        if (!res.ok)
            return [];
        const cycles = await res.json();
        const candidates = candidateCycles(dep.version);
        for (const candidate of candidates) {
            const cycle = cycles.find(c => c.cycle === candidate);
            if (!cycle)
                continue;
            const { eol } = cycle;
            if (eol === false)
                return []; // still supported
            if (eol === true)
                return [{ type: 'eol', cycle: candidate, eolDate: 'unknown' }];
            if (new Date(eol) <= new Date()) {
                return [{ type: 'eol', cycle: candidate, eolDate: eol }];
            }
        }
    }
    catch {
        // Silently skip — endoflife.date may not have data for every product
    }
    return [];
}
//# sourceMappingURL=eol.js.map