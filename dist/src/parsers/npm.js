import { readFile } from 'fs/promises';
import { join } from 'path';
function cleanVersion(raw) {
    // Strip range operators (^, ~, >=, etc.) and take the first concrete version
    return raw
        .replace(/^[^0-9]*/, '')
        .split(/\s+/)[0]
        .split('||')[0]
        .trim();
}
async function fromLockfile(dir) {
    try {
        const content = await readFile(join(dir, 'package-lock.json'), 'utf-8');
        const lock = JSON.parse(content);
        if (!lock.packages)
            return null;
        return Object.entries(lock.packages)
            .filter(([name, pkg]) => name !== '' && !pkg.dev && pkg.version)
            .map(([name, pkg]) => ({
            name: name.replace(/^node_modules\//, ''),
            version: pkg.version,
            ecosystem: 'npm',
        }));
    }
    catch {
        return null;
    }
}
async function fromPackageJson(dir) {
    const content = await readFile(join(dir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(content);
    return Object.entries(pkg.dependencies ?? {})
        .map(([name, version]) => ({
        name,
        version: cleanVersion(version),
        ecosystem: 'npm',
    }))
        .filter(d => d.version && !d.version.includes('github') && !d.version.startsWith('file:'));
}
export async function parseNpm(dir) {
    return (await fromLockfile(dir)) ?? (await fromPackageJson(dir));
}
//# sourceMappingURL=npm.js.map