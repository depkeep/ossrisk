import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Dependency } from '../types.js';

interface LockPackage {
  version?: string;
  dev?: boolean;
  optional?: boolean;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function cleanVersion(raw: string): string {
  // Strip range operators (^, ~, >=, etc.) and take the first concrete version
  return raw
    .replace(/^[^0-9]*/, '')
    .split(/\s+/)[0]
    .split('||')[0]
    .trim();
}

// Convert a lockfile key like "node_modules/express" or
// "node_modules/foo/node_modules/bar" into the unscoped (or scoped) package
// name — i.e. the deepest segment after the last `node_modules/`.
function nameFromLockPath(path: string): string {
  const idx = path.lastIndexOf('node_modules/');
  return idx >= 0 ? path.slice(idx + 'node_modules/'.length) : path;
}

// BFS over the parent → child graph to find a direct dep that ultimately
// pulls `name` in. Returns the direct dep's name, or undefined if no path
// is found.
function findVia(
  name: string,
  directDeps: Set<string>,
  reverseDeps: Map<string, Set<string>>,
): string | undefined {
  if (directDeps.has(name)) return undefined;

  const visited = new Set<string>([name]);
  const queue: string[] = [name];
  while (queue.length > 0) {
    const node = queue.shift()!;
    const parents = reverseDeps.get(node);
    if (!parents) continue;
    for (const parent of parents) {
      if (visited.has(parent)) continue;
      if (directDeps.has(parent)) return parent;
      visited.add(parent);
      queue.push(parent);
    }
  }
  return undefined;
}

async function fromLockfile(dir: string): Promise<Dependency[] | null> {
  try {
    const content = await readFile(join(dir, 'package-lock.json'), 'utf-8');
    const lock = JSON.parse(content) as {
      packages?: Record<string, LockPackage>;
    };

    if (!lock.packages) return null;

    const root = lock.packages[''] ?? {};
    // A "direct dep" is anything the root package depends on (runtime or
    // optional). Dev deps are excluded entirely below.
    const directDeps = new Set<string>([
      ...Object.keys(root.dependencies ?? {}),
      ...Object.keys(root.optionalDependencies ?? {}),
    ]);

    // Build child → parents reverse graph for via lookups.
    const reverseDeps = new Map<string, Set<string>>();
    for (const [path, pkg] of Object.entries(lock.packages)) {
      if (path === '') continue;
      const parentName = nameFromLockPath(path);
      const children = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.optionalDependencies ?? {}),
      ];
      for (const child of children) {
        if (!reverseDeps.has(child)) reverseDeps.set(child, new Set());
        reverseDeps.get(child)!.add(parentName);
      }
    }

    const deps: Dependency[] = [];
    const seen = new Set<string>();

    for (const [path, pkg] of Object.entries(lock.packages)) {
      if (path === '' || pkg.dev || !pkg.version) continue;
      const name = nameFromLockPath(path);
      // The same package can appear at multiple lock paths (hoisting edge
      // cases); dedupe by name@version.
      const key = `${name}@${pkg.version}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const isDirect = directDeps.has(name);
      deps.push({
        name,
        version: pkg.version,
        ecosystem: 'npm',
        isDirect,
        via: isDirect ? undefined : findVia(name, directDeps, reverseDeps),
      });
    }

    return deps;
  } catch {
    return null;
  }
}

async function fromPackageJson(dir: string): Promise<Dependency[]> {
  const content = await readFile(join(dir, 'package.json'), 'utf-8');
  const pkg = JSON.parse(content) as {
    dependencies?: Record<string, string>;
  };

  return Object.entries(pkg.dependencies ?? {})
    .map(([name, version]) => ({
      name,
      version: cleanVersion(version),
      ecosystem: 'npm' as const,
      isDirect: true,
    }))
    .filter(d => d.version && !d.version.includes('github') && !d.version.startsWith('file:'));
}

export async function parseNpm(dir: string): Promise<Dependency[]> {
  return (await fromLockfile(dir)) ?? (await fromPackageJson(dir));
}
