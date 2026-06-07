# ossrisk

Scan your dependencies for long-term viability and supply-chain risk: **EOL versions**, **known CVEs**, **abandonment signals**, **typosquatting**, **license compliance**, and **maintainer takeover patterns**.

Supports `package.json` / `package-lock.json` (npm) and `requirements.txt` / `Pipfile.lock` (PyPI). When a lockfile is present, the full resolved tree (direct + transitive) is scanned and each flagged transitive shows the direct dep it came in through.

[![CI](https://github.com/depkeep/ossrisk/actions/workflows/ci.yml/badge.svg)](https://github.com/depkeep/ossrisk/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ossrisk)](https://www.npmjs.com/package/ossrisk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Install

```bash
npm install -g ossrisk
```

Or run without installing:

```bash
npx ossrisk .
```

---

## CLI usage

```
ossrisk [path] [options]
```

| Option | Default | Description |
|---|---|---|
| `[path]` | `.` | Path to project directory to scan |
| `-f, --format <fmt>` | `table` | Output format: `table`, `json`, `markdown` |
| `--fail-on <level>` | `high` | Exit 1 if any dep reaches this risk level (`none`\|`low`\|`medium`\|`high`\|`critical`) |
| `-c, --concurrency <n>` | `8` | Concurrent API requests per batch |
| `--no-eol` | | Skip EOL checks |
| `--no-cve` | | Skip CVE checks |
| `--no-activity` | | Skip abandonment/staleness checks |
| `--no-outdated` | | Skip latest-version checks |
| `--no-typosquat` | | Skip typosquatting checks |
| `--no-license` | | Skip license compliance checks |
| `--no-maintainer` | | Skip maintainer/publisher checks |
| `--no-install-script` | | Skip install-script (preinstall/postinstall) checks |
| `--direct-only` | | Scan only direct dependencies, skip transitives |

### Examples

```bash
# Scan the current directory
ossrisk

# Scan a specific project
ossrisk /path/to/project

# Output as JSON
ossrisk . --format json

# Fail on medium risk or above
ossrisk . --fail-on medium

# Skip CVE checks, output markdown
ossrisk . --no-cve --format markdown
```

---

## Risk levels

| Level | Triggers |
|---|---|
| `critical` | CVE with CVSS ≥ 9.0 |
| `high` | CVE with CVSS 7.0–8.9, EOL version, or suspected typosquat of a popular package |
| `medium` | CVE with CVSS 4.0–6.9, no release in 24+ months (abandoned), strong-copyleft license (GPL/AGPL/SSPL/…), or new-publisher pattern on a >180-day-old package |
| `low` | CVE with CVSS < 4.0, no release in 12–24 months (stale), newer version available, weak-copyleft license (LGPL/MPL/EPL/…), unknown license, sole maintainer, or install lifecycle hooks (`preinstall`/`install`/`postinstall`) |
| `none` | No issues found |

### Maintainer / publisher signals

Two patterns surfaced from npm packument metadata:

- **new-publisher** (`medium`) — the latest release is published by an account that did not publish any of the first three releases, and the package is older than 180 days. This is the `event-stream`-style takeover pattern: long-running package, sudden new face on the most recent publish. False positives are possible (legitimate maintainer handoffs); treat as "review before pinning."
- **sole-maintainer** (`low`) — only one maintainer is registered on the package. Informational bus-factor signal, not a vulnerability.

Both checks are npm-only for now; PyPI's JSON API doesn't expose comparable per-version uploader history. Use `--no-maintainer` to skip these checks.

### Install scripts

npm packages can declare lifecycle hooks (`preinstall`, `install`, `postinstall`) that run automatically on `npm install`. These are a known supply-chain attack vector — several high-profile compromises (e.g. `event-stream`, `node-ipc`) used postinstall scripts to exfiltrate data or deliver payloads.

ossrisk fetches the version-specific manifest from the npm registry and flags any package that declares one or more of these hooks as `low` risk. The signal is informational: many legitimate packages (native add-ons, build tools) use `node-gyp rebuild` as an install script. The intent is to surface the signal so you can consciously decide whether a package's install-time code execution is expected. Use `--no-install-script` to suppress this check.

### Licenses

ossrisk reads each package's declared license from the npm or PyPI registry,
normalizes common variants to SPDX identifiers, and categorizes them:

- **permissive** (MIT, Apache-2.0, BSD, ISC, …) — not flagged
- **weak-copyleft** (LGPL, MPL, EPL, CDDL, …) — flagged as `low`
- **strong-copyleft** (GPL, AGPL, SSPL, OSL, EUPL) — flagged as `medium`
- **unknown** (missing, `UNKNOWN`, or unrecognizable text) — flagged as `low`

The check exists to surface licenses that need legal review before commercial
use; it is not a judgement that any of these licenses are bad. Use
`--no-license` if your project doesn't need this signal.

### Transitive dependencies

ossrisk scans the full resolved dependency tree when a lockfile is present:

- **npm**: `package-lock.json` (lockfileVersion 2+) — every package listed is scanned;
  dev-only deps are excluded.
- **PyPI**: `Pipfile.lock` — `default` group is scanned; if the lockfile preserves
  `_meta.pipfile.packages`, entries are tagged as direct or transitive accordingly.

For flagged transitives, the report shows the direct dependency that pulls them in
(`via express`), so you know which top-level package to update or replace. Use
`--direct-only` to skip transitives entirely.

Without a lockfile (e.g. only `package.json` or only `requirements.txt`), ossrisk
falls back to direct-only scanning.

### Typosquatting

ossrisk compares each dependency name against a curated list of popular npm and PyPI
packages, flagging anything within edit distance 2 or matching common homoglyph
substitutions (e.g. `rn` ↔ `m`, `1` ↔ `l`). A scoped package like `@vendor/lodash`
is compared by its basename. The check is purely local — no API calls.

---

## GitHub Actions

Add ossrisk to your CI pipeline to automatically scan dependencies on every pull request.

```yaml
- name: Scan dependencies
  uses: depkeep/ossrisk@v1
  with:
    fail-on: high
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

When `github-token` is provided and the workflow runs on a pull request, ossrisk posts a markdown report as a PR comment.

### Action inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | Path to the project directory |
| `fail-on` | `high` | Exit 1 if any dep reaches this level or above |
| `no-eol` | `false` | Skip EOL checks |
| `no-cve` | `false` | Skip CVE checks |
| `no-activity` | `false` | Skip abandonment/staleness checks |
| `no-outdated` | `false` | Skip latest-version checks |
| `no-typosquat` | `false` | Skip typosquatting checks |
| `no-license` | `false` | Skip license compliance checks |
| `no-maintainer` | `false` | Skip maintainer/publisher checks |
| `no-install-script` | `false` | Skip install-script (preinstall/postinstall) checks |
| `direct-only` | `false` | Scan only direct dependencies, skip transitives |
| `github-token` | | GitHub token for posting a PR comment |

### Action outputs

| Output | Description |
|---|---|
| `risk-level` | Highest risk level found across all dependencies |

---

## Programmatic API

```ts
import { scan } from 'ossrisk';

const result = await scan({
  path: '/path/to/project',
  format: 'json',
  failOn: 'high',
  concurrency: 8,
  noEol: false,
  noCve: false,
  noActivity: false,
  noOutdated: false,
  noTyposquat: false,
  noLicense: false,
  noMaintainer: false,
  noInstallScript: false,
  directOnly: false,
});

console.log(result.summary);
// { total: 42, critical: 0, high: 1, medium: 3, low: 5, clean: 33 }
```

---

## Data sources

- **CVEs** — [OSV.dev](https://osv.dev) batch API
- **EOL dates** — [endoflife.date](https://endoflife.date) API
- **Activity** — npm registry / PyPI JSON API
- **Latest versions** — npm registry / PyPI JSON API
- **Typosquatting** — local curated list of popular npm & PyPI packages (no API calls)
- **Licenses** — `license` field from npm registry; `info.classifiers` and `info.license` from PyPI
- **Maintainer signals** — `maintainers`, `versions[v]._npmUser`, and `time` from the npm registry (npm only)
- **Install scripts** — `scripts` field from the version-specific npm registry manifest (npm only)

All checks are read-only and require no API keys.

---

## Contributing

```bash
git clone https://github.com/depkeep/ossrisk.git
cd ossrisk
npm install
npm test          # run tests
npm run dev .     # run CLI from source
```

Before submitting a PR, run `npm run build` and commit the updated `dist/` so the GitHub Action stays functional.

---

## License

MIT © [DepKeep](https://depkeep.com)
