// SPDX identifiers (and a few common variants) for licenses that meaningfully
// constrain commercial use without legal review.
const STRONG_COPYLEFT = new Set([
    'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later', 'AGPL-1.0',
    'GPL-3.0', 'GPL-3.0-only', 'GPL-3.0-or-later',
    'GPL-2.0', 'GPL-2.0-only', 'GPL-2.0-or-later',
    'GPL-1.0', 'GPL-1.0-only', 'GPL-1.0-or-later',
    'SSPL-1.0',
    'OSL-3.0', 'OSL-2.1', 'OSL-2.0', 'OSL-1.1', 'OSL-1.0',
    'EUPL-1.2', 'EUPL-1.1',
]);
const WEAK_COPYLEFT = new Set([
    'LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
    'LGPL-2.1', 'LGPL-2.1-only', 'LGPL-2.1-or-later',
    'LGPL-2.0', 'LGPL-2.0-only', 'LGPL-2.0-or-later',
    'MPL-2.0', 'MPL-1.1', 'MPL-1.0',
    'EPL-2.0', 'EPL-1.0',
    'CDDL-1.0', 'CDDL-1.1',
    'CC-BY-SA-4.0', 'CC-BY-SA-3.0',
]);
// PyPI's `info.license` field is freeform; classifiers carry the structured
// identification. This maps the common "License :: …" classifiers to SPDX.
const PYPI_CLASSIFIER_MAP = {
    'License :: OSI Approved :: MIT License': 'MIT',
    'License :: OSI Approved :: Apache Software License': 'Apache-2.0',
    'License :: OSI Approved :: BSD License': 'BSD-3-Clause',
    'License :: OSI Approved :: ISC License (ISCL)': 'ISC',
    'License :: OSI Approved :: GNU General Public License (GPL)': 'GPL-2.0',
    'License :: OSI Approved :: GNU General Public License v2 (GPLv2)': 'GPL-2.0',
    'License :: OSI Approved :: GNU General Public License v2 or later (GPLv2+)': 'GPL-2.0-or-later',
    'License :: OSI Approved :: GNU General Public License v3 (GPLv3)': 'GPL-3.0',
    'License :: OSI Approved :: GNU General Public License v3 or later (GPLv3+)': 'GPL-3.0-or-later',
    'License :: OSI Approved :: GNU Lesser General Public License v2 (LGPLv2)': 'LGPL-2.0',
    'License :: OSI Approved :: GNU Lesser General Public License v2 or later (LGPLv2+)': 'LGPL-2.0-or-later',
    'License :: OSI Approved :: GNU Lesser General Public License v3 (LGPLv3)': 'LGPL-3.0',
    'License :: OSI Approved :: GNU Lesser General Public License v3 or later (LGPLv3+)': 'LGPL-3.0-or-later',
    'License :: OSI Approved :: GNU Affero General Public License v3': 'AGPL-3.0',
    'License :: OSI Approved :: GNU Affero General Public License v3 or later (AGPLv3+)': 'AGPL-3.0-or-later',
    'License :: OSI Approved :: Mozilla Public License 2.0 (MPL 2.0)': 'MPL-2.0',
    'License :: OSI Approved :: Eclipse Public License 1.0 (EPL-1.0)': 'EPL-1.0',
    'License :: OSI Approved :: Eclipse Public License 2.0 (EPL-2.0)': 'EPL-2.0',
};
// Try to normalize a raw license string to a canonical SPDX identifier so we
// can match it against the copyleft sets. Falls back to the input for unknown
// strings; the caller treats those as `unknown` only if we can't recognize them.
function normalize(raw) {
    const trimmed = raw.trim();
    const upper = trimmed.toUpperCase();
    if (upper === 'UNKNOWN' || upper === 'NOASSERTION' || upper === 'OTHER/PROPRIETARY LICENSE') {
        return 'UNKNOWN';
    }
    // SPDX expressions like "(MIT OR Apache-2.0)" — too ambiguous to classify
    // unless one side is restrictive; just return as-is.
    if (trimmed.startsWith('('))
        return trimmed;
    // Common upper-case GPL/LGPL/AGPL/MPL strings → SPDX.
    // The `[\s\-v]?` accepts the common separators: dash, space, or `v` (as in `GPLv3`).
    if (/^AGPL[\s\-v]?3/i.test(trimmed))
        return 'AGPL-3.0';
    if (/^GPL[\s\-v]?3/i.test(trimmed))
        return 'GPL-3.0';
    if (/^GPL[\s\-v]?2/i.test(trimmed))
        return 'GPL-2.0';
    if (/^LGPL[\s\-v]?3/i.test(trimmed))
        return 'LGPL-3.0';
    if (/^LGPL[\s\-v]?2/i.test(trimmed))
        return 'LGPL-2.1';
    if (/^MPL[\s\-v]?2/i.test(trimmed))
        return 'MPL-2.0';
    if (/^EPL[\s\-v]?2/i.test(trimmed))
        return 'EPL-2.0';
    if (/^EPL[\s\-v]?1/i.test(trimmed))
        return 'EPL-1.0';
    if (/^SSPL/i.test(trimmed))
        return 'SSPL-1.0';
    return trimmed;
}
function categorize(license) {
    if (license === 'UNKNOWN')
        return 'unknown';
    if (STRONG_COPYLEFT.has(license))
        return 'strong-copyleft';
    if (WEAK_COPYLEFT.has(license))
        return 'weak-copyleft';
    return 'permissive';
}
async function npmLicense(name) {
    try {
        const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, { headers: { Accept: 'application/json' } });
        if (!res.ok)
            return null;
        const data = await res.json();
        if (typeof data.license === 'string')
            return data.license;
        if (data.license && typeof data.license === 'object' && data.license.type) {
            return data.license.type;
        }
        if (Array.isArray(data.licenses) && data.licenses[0]?.type) {
            return data.licenses[0].type;
        }
        return null;
    }
    catch {
        return null;
    }
}
async function pypiLicense(name) {
    try {
        const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
        if (!res.ok)
            return null;
        const data = await res.json();
        // Prefer classifiers — they're structured. Many packages set `info.license`
        // to a multi-paragraph license text, which is useless for matching.
        for (const c of data.info.classifiers ?? []) {
            const spdx = PYPI_CLASSIFIER_MAP[c];
            if (spdx)
                return spdx;
        }
        const raw = data.info.license?.trim();
        if (raw && raw.length > 0 && raw.length < 80)
            return raw;
        return null;
    }
    catch {
        return null;
    }
}
export async function checkLicense(dep) {
    try {
        let raw = null;
        if (dep.ecosystem === 'npm')
            raw = await npmLicense(dep.name);
        if (dep.ecosystem === 'pypi')
            raw = await pypiLicense(dep.name);
        if (dep.ecosystem !== 'npm' && dep.ecosystem !== 'pypi')
            return [];
        if (!raw) {
            return [{ type: 'license', license: 'UNKNOWN', category: 'unknown' }];
        }
        const license = normalize(raw);
        const category = categorize(license);
        if (category === 'permissive')
            return [];
        return [{ type: 'license', license, category }];
    }
    catch {
        // Registry unreachable — not a failure condition
    }
    return [];
}
//# sourceMappingURL=license.js.map