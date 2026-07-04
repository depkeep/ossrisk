import type { Checker } from '../types.js';
import { checkCvesBatch } from './osv.js';
import { checkEol } from './eol.js';
import { checkActivity } from './activity.js';
import { checkOutdated } from './outdated.js';
import { checkLicense } from './license.js';
import { checkMaintainer } from './maintainer.js';
import { checkInstallScript } from './install-script.js';
import { checkTyposquat } from './typosquat.js';

// The ordered checker registry. Order determines the order signals appear in a
// dependency's result (and therefore in table/markdown output), so it is kept
// intentional: the batched CVE pre-pass first, then the per-dependency checks
// cheapest-network-cost first, with the purely-local typosquat check last.
//
// To add a checker, implement the `Checker` interface and push it here (or, for
// third-party use, `import { CHECKERS }` and `.push(...)` before calling scan).
export const CHECKERS: Checker[] = [
  {
    name: 'cve',
    description: 'Known CVEs / advisories via the OSV batch API',
    enabled: opts => !opts.noCve,
    batch: checkCvesBatch,
  },
  {
    name: 'eol',
    description: 'End-of-life runtime/framework versions',
    enabled: opts => !opts.noEol,
    check: checkEol,
  },
  {
    name: 'activity',
    description: 'Abandonment / staleness from last-release date',
    enabled: opts => !opts.noActivity,
    check: checkActivity,
  },
  {
    name: 'outdated',
    description: 'A newer version is available',
    enabled: opts => !opts.noOutdated,
    check: checkOutdated,
  },
  {
    name: 'license',
    description: 'Copyleft / unknown license compliance',
    enabled: opts => !opts.noLicense,
    check: checkLicense,
  },
  {
    name: 'maintainer',
    description: 'New-publisher / sole-maintainer takeover patterns',
    enabled: opts => !opts.noMaintainer,
    check: checkMaintainer,
  },
  {
    name: 'install-script',
    description: 'preinstall / install / postinstall lifecycle hooks',
    enabled: opts => !opts.noInstallScript,
    check: checkInstallScript,
  },
  {
    name: 'typosquat',
    description: 'Typosquat of a popular package (local, no API)',
    enabled: opts => !opts.noTyposquat,
    check: checkTyposquat,
  },
];
