#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { Command } from 'commander';
import { scan } from './scanner.js';
import { evaluatePolicy } from './policy.js';
import { renderTable } from './output/table.js';
import { renderMarkdown } from './output/markdown.js';
import type { RiskLevel, ScanOptions } from './types.js';

function readVersion(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  // '../package.json' works when running via `tsx src/cli.ts` (dev)
  // '../../package.json' works from the compiled `dist/src/cli.js`
  for (const rel of ['../package.json', '../../package.json']) {
    try {
      const p = JSON.parse(readFileSync(join(dir, rel), 'utf-8')) as { name?: string; version?: string };
      if (p.name === 'ossrisk' && p.version) return p.version;
    } catch { /* skip */ }
  }
  return '0.0.0';
}

const RISK_ORDER: RiskLevel[] = ['none', 'low', 'medium', 'high', 'critical'];

const program = new Command();

program
  .name('ossrisk')
  .description(
    'Scan dependencies for long-term viability risk:\n' +
    'EOL versions, known CVEs, and abandonment signals.\n\n' +
    'Supports: package.json (npm), requirements.txt (PyPI)'
  )
  .version(readVersion());

program
  .argument('[path]', 'Path to project directory to scan', '.')
  .option('-f, --format <fmt>',  'Output format: table | json | markdown', 'table')
  .option('--fail-on <level>',   'Exit 1 if any dep reaches this level or above (none|low|medium|high|critical)', 'high')
  .option('--policy <path>',     'Evaluate results against OPA Rego policies — file or directory (requires the opa CLI)')
  .option('-c, --concurrency <n>', 'Concurrent API requests per batch', '8')
  .option('--no-eol',            'Skip EOL checks')
  .option('--no-cve',            'Skip CVE checks')
  .option('--no-activity',       'Skip abandonment/staleness checks')
  .option('--no-outdated',       'Skip latest-version checks')
  .option('--no-typosquat',      'Skip typosquatting checks')
  .option('--no-license',        'Skip license compliance checks')
  .option('--no-maintainer',     'Skip maintainer/publisher checks')
  .option('--no-install-script', 'Skip install-script (preinstall/postinstall) checks')
  .option('--direct-only',       'Scan only direct dependencies, skip transitives')
  .action(async (pathArg: string, options) => {
    const opts: ScanOptions = {
      path:        resolve(pathArg),
      format:      options.format as ScanOptions['format'],
      failOn:      options.failOn as RiskLevel,
      policy:      options.policy ? resolve(options.policy as string) : undefined,
      concurrency: parseInt(options.concurrency, 10) || 8,
      noEol:       !options.eol,
      noCve:       !options.cve,
      noActivity:  !options.activity,
      noOutdated:  !options.outdated,
      noTyposquat: !options.typosquat,
      noLicense:       !options.license,
      noMaintainer:    !options.maintainer,
      noInstallScript: !options.installScript,
      directOnly:      !!options.directOnly,
    };

    try {
      if (opts.format === 'table') {
        process.stdout.write('\r  Scanning…');
      }

      const result = await scan(opts);

      if (opts.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (opts.format === 'markdown') {
        console.log(renderMarkdown(result));
      } else {
        process.stdout.write('\r' + ' '.repeat(20) + '\r');
        console.log(renderTable(result));
      }

      let breached = false;

      if (opts.policy) {
        // Violations go to stderr so `--format json` stdout stays pipeable.
        const violations = await evaluatePolicy(result, opts.policy);
        for (const msg of violations) {
          console.error(`  policy violation: ${msg}`);
        }
        if (violations.length > 0) breached = true;
      }

      if (opts.failOn !== 'none') {
        const threshold = RISK_ORDER.indexOf(opts.failOn);
        breached ||= result.results.some(
          r => RISK_ORDER.indexOf(r.riskLevel) >= threshold
        );
      }

      if (breached) process.exit(1);
    } catch (err) {
      console.error(`\n  error: ${(err as Error).message}`);
      process.exit(2);
    }
  });

program.parse();
