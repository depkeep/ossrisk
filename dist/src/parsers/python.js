import { readFile } from 'fs/promises';
import { join } from 'path';
function cleanVersion(spec) {
    const match = spec.match(/[=~><!]+\s*([0-9][0-9a-zA-Z._-]*)/);
    return match ? match[1] : spec.trim();
}
export async function parsePython(dir) {
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
        const name = match[1].toLowerCase().replace(/_/g, '-');
        const version = match[2] ? cleanVersion(match[2]) : '0.0.0';
        deps.push({ name, version, ecosystem: 'pypi' });
    }
    return deps;
}
//# sourceMappingURL=python.js.map