import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
function cleanVersion(spec) {
    const match = spec.match(/[=~><!]+\s*([0-9][0-9a-zA-Z._-]*)/);
    return match ? match[1] : spec.trim();
}
function normalizeName(name) {
    return name.toLowerCase().replace(/_/g, '-');
}
async function fromRequirementsTxt(dir) {
    const content = await readFile(join(dir, 'requirements.txt'), 'utf-8');
    const deps = [];
    for (const raw of content.split('\n')) {
        const line = raw.split('#')[0].trim();
        if (!line || line.startsWith('-'))
            continue;
        // e.g. "Django==4.2.0", "requests>=2.28.0", "flask~=2.3"
        const match = line.match(/^([a-zA-Z0-9_.-]+)\s*([=~><!][=~>!]?\s*[0-9][0-9a-zA-Z._-]*)?/);
        if (!match)
            continue;
        const name = normalizeName(match[1]);
        const version = match[2] ? cleanVersion(match[2]) : '0.0.0';
        // requirements.txt has no way to distinguish direct from transitive,
        // so we treat every entry as direct (best-effort).
        deps.push({ name, version, ecosystem: 'pypi', isDirect: true });
    }
    return deps;
}
// Pipfile.lock pins the full resolved tree (direct + transitive) under
// "default". The lockfile itself doesn't distinguish them, but the original
// Pipfile section (when embedded under _meta.pipfile) lists the direct deps.
async function fromPipfileLock(dir) {
    const content = await readFile(join(dir, 'Pipfile.lock'), 'utf-8');
    const lock = JSON.parse(content);
    const directNames = new Set(Object.keys(lock._meta?.pipfile?.packages ?? {}).map(normalizeName));
    const deps = [];
    for (const [name, info] of Object.entries(lock.default ?? {})) {
        if (!info.version)
            continue;
        const normName = normalizeName(name);
        deps.push({
            name: normName,
            version: cleanVersion(info.version),
            ecosystem: 'pypi',
            // If we couldn't recover the original Pipfile direct list, treat
            // everything as direct rather than mislabel deps as transitive
            // with no via.
            isDirect: directNames.size === 0 || directNames.has(normName),
        });
    }
    return deps;
}
export async function parsePython(dir) {
    // Prefer Pipfile.lock when present — it gives us the full resolved tree.
    if (existsSync(join(dir, 'Pipfile.lock'))) {
        return fromPipfileLock(dir);
    }
    return fromRequirementsTxt(dir);
}
//# sourceMappingURL=python.js.map