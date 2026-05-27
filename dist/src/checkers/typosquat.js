import { POPULAR_NPM, POPULAR_NPM_SET, POPULAR_PYPI, POPULAR_PYPI_SET, } from '../data/popular-packages.js';
const MIN_NAME_LEN = 4;
const MAX_DISTANCE = 2;
// Below this length, require an exact distance-1 match. Distance 2 across
// 4-5 char names means ~40-50% of characters differ — that's a different
// word, not a typo (asap/tsup, jose/core, vfile/vite all sit in that band
// as legitimately distinct packages).
const SHORT_LEN_THRESHOLD = 7;
// Homoglyph substitutions: each pair maps a sequence to a visually similar one.
// When attackers substitute `rn` → `m` (e.g. `expmss` for `express`), edit
// distance alone underweights the risk.
const HOMOGLYPH_PAIRS = [
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
function damerauLevenshtein(a, b) {
    if (a === b)
        return 0;
    const m = a.length;
    const n = b.length;
    if (m === 0)
        return n;
    if (n === 0)
        return m;
    const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        d[i][0] = i;
    for (let j = 0; j <= n; j++)
        d[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, // deletion
            d[i][j - 1] + 1, // insertion
            d[i - 1][j - 1] + cost // substitution
            );
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
            }
        }
    }
    return d[m][n];
}
function isHomoglyphOf(suspect, target) {
    for (const [from, to] of HOMOGLYPH_PAIRS) {
        if (!suspect.includes(from))
            continue;
        if (suspect.split(from).join(to) === target)
            return true;
    }
    return false;
}
// Strip an npm scope prefix so `@vendor/lodash` compares as `lodash`.
function basename(name) {
    if (name.startsWith('@')) {
        const slash = name.indexOf('/');
        return slash >= 0 ? name.slice(slash + 1) : name;
    }
    return name;
}
function findMatch(name, targets) {
    if (name.length < MIN_NAME_LEN)
        return null;
    for (const target of targets) {
        const tBase = basename(target);
        if (tBase === name)
            continue;
        if (Math.abs(tBase.length - name.length) > MAX_DISTANCE)
            continue;
        if (isHomoglyphOf(name, tBase)) {
            return { target, reason: 'homoglyph', distance: 0 };
        }
        const maxDist = Math.min(name.length, tBase.length) < SHORT_LEN_THRESHOLD
            ? 1
            : MAX_DISTANCE;
        const d = damerauLevenshtein(name, tBase);
        if (d > 0 && d <= maxDist) {
            return { target, reason: 'edit-distance', distance: d };
        }
    }
    return null;
}
export function checkTyposquat(dep) {
    let popularSet;
    let popularList;
    if (dep.ecosystem === 'npm') {
        popularSet = POPULAR_NPM_SET;
        popularList = POPULAR_NPM;
    }
    else if (dep.ecosystem === 'pypi') {
        popularSet = POPULAR_PYPI_SET;
        popularList = POPULAR_PYPI;
    }
    else {
        return [];
    }
    // Scoped npm packages have verified scope ownership: @babel/parser is
    // published by the babel team, not pretending to be `parcel`. Comparing
    // scoped basenames against unscoped popular targets generates overwhelming
    // false positives (@astrojs/prism↔prisma, @floating-ui/core↔ora, …) and
    // detecting real scope-confusion attacks (@bable/lodash) needs per-scope
    // reputation data we don't have — so opt out entirely for scoped names.
    if (dep.name.startsWith('@'))
        return [];
    // If the package itself is in the popular list, it cannot be a typosquat.
    if (popularSet.has(dep.name))
        return [];
    const match = findMatch(dep.name, popularList);
    if (!match)
        return [];
    return [{
            type: 'typosquat',
            suspectedTarget: match.target,
            reason: match.reason,
            distance: match.distance,
        }];
}
//# sourceMappingURL=typosquat.js.map