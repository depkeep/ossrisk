import type { Dependency, TyposquatSignal } from '../types.js';
import {
  POPULAR_NPM,
  POPULAR_NPM_SET,
  POPULAR_PYPI,
  POPULAR_PYPI_SET,
} from '../data/popular-packages.js';

const MIN_NAME_LEN = 4;
const MAX_DISTANCE = 2;

// Homoglyph substitutions: each pair maps a sequence to a visually similar one.
// When attackers substitute `rn` → `m` (e.g. `expmss` for `express`), edit
// distance alone underweights the risk.
const HOMOGLYPH_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['rn', 'm'],
  ['m', 'rn'],
  ['l', '1'],
  ['1', 'l'],
  ['l', 'i'],
  ['i', 'l'],
  ['o', '0'],
  ['0', 'o'],
  ['cl', 'd'],
  ['d', 'cl'],
];

// Damerau-Levenshtein distance: like Levenshtein, but counts a swap of two
// adjacent characters (e.g. `lodahs` ↔ `lodash`) as a single edit. Adjacent
// transpositions are the most common kind of human typo, so this metric is
// substantially more accurate than plain Levenshtein for typosquat detection.
function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }

  return d[m][n];
}

function isHomoglyphOf(suspect: string, target: string): boolean {
  for (const [from, to] of HOMOGLYPH_PAIRS) {
    if (!suspect.includes(from)) continue;
    if (suspect.split(from).join(to) === target) return true;
  }
  return false;
}

// Strip an npm scope prefix so `@vendor/lodash` compares as `lodash`.
function basename(name: string): string {
  if (name.startsWith('@')) {
    const slash = name.indexOf('/');
    return slash >= 0 ? name.slice(slash + 1) : name;
  }
  return name;
}

interface Match {
  target: string;
  reason: 'edit-distance' | 'homoglyph';
  distance: number;
}

function findMatch(name: string, targets: readonly string[]): Match | null {
  const candidate = basename(name);
  if (candidate.length < MIN_NAME_LEN) return null;

  for (const target of targets) {
    if (target === name || target === candidate) continue;
    const tBase = basename(target);
    if (Math.abs(tBase.length - candidate.length) > MAX_DISTANCE) continue;
    if (isHomoglyphOf(candidate, tBase)) {
      return { target, reason: 'homoglyph', distance: 0 };
    }
    const d = damerauLevenshtein(candidate, tBase);
    if (d > 0 && d <= MAX_DISTANCE) {
      return { target, reason: 'edit-distance', distance: d };
    }
  }
  return null;
}

export function checkTyposquat(dep: Dependency): TyposquatSignal[] {
  let popularSet: ReadonlySet<string>;
  let popularList: readonly string[];

  if (dep.ecosystem === 'npm') {
    popularSet = POPULAR_NPM_SET;
    popularList = POPULAR_NPM;
  } else if (dep.ecosystem === 'pypi') {
    popularSet = POPULAR_PYPI_SET;
    popularList = POPULAR_PYPI;
  } else {
    return [];
  }

  // If the package itself is in the popular list, it cannot be a typosquat.
  if (popularSet.has(dep.name) || popularSet.has(basename(dep.name))) return [];

  const match = findMatch(dep.name, popularList);
  if (!match) return [];

  return [{
    type: 'typosquat',
    suspectedTarget: match.target,
    reason: match.reason,
    distance: match.distance,
  }];
}
