import { POPULAR_NPM, POPULAR_NPM_SET, POPULAR_PYPI, POPULAR_PYPI_SET, } from '../data/popular-packages.js';
const MIN_NAME_LEN = 4;
const MAX_DISTANCE = 2;
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
function levenshtein(a, b) {
    if (a === b)
        return 0;
    const m = a.length;
    const n = b.length;
    if (m === 0)
        return n;
    if (n === 0)
        return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    const curr = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        prev = curr.slice();
    }
    return prev[n];
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
    const candidate = basename(name);
    if (candidate.length < MIN_NAME_LEN)
        return null;
    for (const target of targets) {
        if (target === name || target === candidate)
            continue;
        const tBase = basename(target);
        if (Math.abs(tBase.length - candidate.length) > MAX_DISTANCE)
            continue;
        if (isHomoglyphOf(candidate, tBase)) {
            return { target, reason: 'homoglyph', distance: 0 };
        }
        const d = levenshtein(candidate, tBase);
        if (d > 0 && d <= MAX_DISTANCE) {
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
    // If the package itself is in the popular list, it cannot be a typosquat.
    if (popularSet.has(dep.name) || popularSet.has(basename(dep.name)))
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