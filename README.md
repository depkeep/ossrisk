# ossrisk

Scan your dependencies for long-term viability risk: **EOL versions**, **known CVEs**, and **abandonment signals**.

Supports `package.json` (npm) and `requirements.txt` (PyPI).

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
| `high` | CVE with CVSS 7.0–8.9, or EOL version |
| `medium` | CVE with CVSS 4.0–6.9, or no release in 24+ months (abandoned) |
| `low` | CVE with CVSS < 4.0, no release in 12–24 months (stale), or newer version available |
| `none` | No issues found |

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
