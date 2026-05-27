import type { Dependency, MaintainerSignal } from '../types.js';

// A package must be at least this old before a new-publisher signal makes
// sense — younger packages haven't had time to establish a publishing pattern,
// so a "new" publisher is meaningless.
const MIN_AGE_DAYS_FOR_NEW_PUBLISHER = 180;

// Number of earliest releases used to define the package's "founding publishers".
// Smaller than this and we don't have enough signal to compare against.
const EARLY_RELEASE_WINDOW = 3;

interface NpmUser { name?: string; email?: string }
interface NpmVersionMeta { _npmUser?: NpmUser }
interface NpmPackument {
  maintainers?: NpmUser[];
  versions?: Record<string, NpmVersionMeta>;
  time?: Record<string, string>;
  'dist-tags'?: { latest?: string };
}

// Returns version names sorted by publish date (ascending). Versions whose
// publish timestamp can't be resolved from `time` are dropped — we can't
// place them on the timeline.
function chronologicalVersions(p: NpmPackument): string[] {
  const time = p.time ?? {};
  const versions = Object.keys(p.versions ?? {});
  return versions
    .filter(v => typeof time[v] === 'string')
    .sort((a, b) => new Date(time[a]).getTime() - new Date(time[b]).getTime());
}

function ageDays(p: NpmPackument): number | null {
  const created = p.time?.created;
  if (!created) return null;
  return (Date.now() - new Date(created).getTime()) / (1000 * 60 * 60 * 24);
}

function detectNewPublisher(p: NpmPackument): MaintainerSignal | null {
  const age = ageDays(p);
  if (age === null || age < MIN_AGE_DAYS_FOR_NEW_PUBLISHER) return null;

  const ordered = chronologicalVersions(p);
  if (ordered.length < EARLY_RELEASE_WINDOW + 1) return null;

  const versions = p.versions ?? {};
  const latestVersion = p['dist-tags']?.latest ?? ordered[ordered.length - 1];
  const latestPublisher = versions[latestVersion]?._npmUser?.name;
  if (!latestPublisher) return null;

  const earlyPublishers = new Set<string>();
  for (const v of ordered.slice(0, EARLY_RELEASE_WINDOW)) {
    const name = versions[v]?._npmUser?.name;
    if (name) earlyPublishers.add(name);
  }
  if (earlyPublishers.size === 0) return null;
  if (earlyPublishers.has(latestPublisher)) return null;

  return {
    type: 'maintainer',
    pattern: 'new-publisher',
    detail:
      `latest release published by "${latestPublisher}", ` +
      `who did not publish any of the first ${EARLY_RELEASE_WINDOW} versions`,
  };
}

function detectSoleMaintainer(p: NpmPackument): MaintainerSignal | null {
  const maintainers = p.maintainers ?? [];
  if (maintainers.length !== 1) return null;
  const name = maintainers[0].name ?? 'unknown';
  return {
    type: 'maintainer',
    pattern: 'sole-maintainer',
    detail: `only one maintainer registered: "${name}"`,
  };
}

async function fetchPackument(name: string): Promise<NpmPackument | null> {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(name)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    return await res.json() as NpmPackument;
  } catch {
    return null;
  }
}

export async function checkMaintainer(dep: Dependency): Promise<MaintainerSignal[]> {
  // PyPI's JSON API does not expose maintainer history in a way comparable to
  // npm's _npmUser-per-version data, so this check is npm-only for now.
  if (dep.ecosystem !== 'npm') return [];

  const packument = await fetchPackument(dep.name);
  if (!packument) return [];

  const signals: MaintainerSignal[] = [];
  const newPub = detectNewPublisher(packument);
  if (newPub) signals.push(newPub);
  const sole = detectSoleMaintainer(packument);
  if (sole) signals.push(sole);
  return signals;
}
