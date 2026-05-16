import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Dependency } from '../types.js';

function cleanVersion(raw: string): string {
  // Strip range operators (^, ~, >=, etc.) and take the first concrete version
  return raw
    .replace(/^[^0-9]*/, '')
    .split(/\s+/)[0]
    .split('||')[0]
    .trim();
}

async function fromLockfile(dir: string): Promise<Dependency[] | null> {
  try {
    const content = await readFile(join(dir, 'package-lock.json'), 'utf-8');
    const lock = JSON.parse(content) as {
      packages?: Record<string, { version: string; dev?: boolean }>;
    };

    if (!lock.packages) return null;

    return Object.entries(lock.packages)
      .filter(([name, pkg]) => name !== '' && !pkg.dev && pkg.version)
      .map(([name, pkg]) => ({
        name: name.replace(/^node_modules\//, ''),
        version: pkg.version,
        ecosystem: 'npm' as const,
      }));
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
    }))
    .filter(d => d.version && !d.version.includes('github') && !d.version.startsWith('file:'));
}

export async function parseNpm(dir: string): Promise<Dependency[]> {
  return (await fromLockfile(dir)) ?? (await fromPackageJson(dir));
}
