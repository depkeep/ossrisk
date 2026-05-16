import type { Dependency, OutdatedSignal } from '../types.js';

async function latestNpmVersion(name: string): Promise<string | null> {
  const res = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) return null;
  const data = await res.json() as { version?: string };
  return data.version ?? null;
}

async function latestPypiVersion(name: string): Promise<string | null> {
  const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
  if (!res.ok) return null;
  const data = await res.json() as { info?: { version?: string } };
  return data.info?.version ?? null;
}

export async function checkOutdated(dep: Dependency): Promise<OutdatedSignal[]> {
  try {
    let latest: string | null = null;

    if (dep.ecosystem === 'npm') {
      latest = await latestNpmVersion(dep.name);
    } else if (dep.ecosystem === 'pypi') {
      latest = await latestPypiVersion(dep.name);
    }

    if (!latest || latest === dep.version) return [];

    return [{ type: 'outdated', latestVersion: latest }];
  } catch {
    // Registry unreachable — not a failure condition
  }

  return [];
}
