import type { AbandonedSignal, Dependency, StaleSignal } from '../types.js';

const ABANDONED_MONTHS = 24;
const STALE_MONTHS = 12;

function monthsSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

async function lastNpmRelease(name: string): Promise<Date | null> {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json() as { time?: Record<string, string> };
  const modified = data.time?.modified;
  return modified ? new Date(modified) : null;
}

async function lastPypiRelease(name: string): Promise<Date | null> {
  const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
  if (!res.ok) return null;
  const data = await res.json() as {
    info: { version: string };
    releases: Record<string, Array<{ upload_time: string }>>;
  };
  const files = data.releases[data.info.version];
  if (!files?.length) return null;
  return new Date(files[0].upload_time);
}

export async function checkActivity(
  dep: Dependency
): Promise<(AbandonedSignal | StaleSignal)[]> {
  try {
    let last: Date | null = null;

    if (dep.ecosystem === 'npm')  last = await lastNpmRelease(dep.name);
    if (dep.ecosystem === 'pypi') last = await lastPypiRelease(dep.name);

    if (!last) return [];

    const months = Math.floor(monthsSince(last));
    const dateStr = last.toISOString().split('T')[0];

    if (months >= ABANDONED_MONTHS) {
      return [{ type: 'abandoned', lastReleaseDate: dateStr, monthsSince: months }];
    }
    if (months >= STALE_MONTHS) {
      return [{ type: 'stale', lastReleaseDate: dateStr, monthsSince: months }];
    }
  } catch {
    // Registry unreachable — not a failure condition
  }

  return [];
}
