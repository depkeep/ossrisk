import { describe, it, expect } from 'vitest';
import { CHECKERS } from '../../src/checkers/index.js';
import type { ScanOptions } from '../../src/types.js';

const baseOpts: ScanOptions = {
  path: '.',
  format: 'table',
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
};

describe('CHECKERS registry', () => {
  it('registers a checker for every risk dimension in a stable order', () => {
    expect(CHECKERS.map(c => c.name)).toEqual([
      'cve', 'eol', 'activity', 'outdated',
      'license', 'maintainer', 'install-script', 'typosquat',
    ]);
  });

  it('gives every checker a name, description, and at least one of batch/check', () => {
    for (const c of CHECKERS) {
      expect(c.name).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.batch ?? c.check).toBeDefined();
    }
  });

  it('runs the CVE checker as a batch pre-pass, others per-dependency', () => {
    const cve = CHECKERS.find(c => c.name === 'cve')!;
    expect(cve.batch).toBeInstanceOf(Function);
    expect(cve.check).toBeUndefined();

    for (const c of CHECKERS.filter(c => c.name !== 'cve')) {
      expect(c.check).toBeInstanceOf(Function);
      expect(c.batch).toBeUndefined();
    }
  });

  it('enables every checker by default', () => {
    for (const c of CHECKERS) {
      expect(c.enabled(baseOpts)).toBe(true);
    }
  });

  it('maps each --no-<name> flag to the matching checker', () => {
    const cases: [keyof ScanOptions, string][] = [
      ['noCve', 'cve'],
      ['noEol', 'eol'],
      ['noActivity', 'activity'],
      ['noOutdated', 'outdated'],
      ['noLicense', 'license'],
      ['noMaintainer', 'maintainer'],
      ['noInstallScript', 'install-script'],
      ['noTyposquat', 'typosquat'],
    ];
    for (const [flag, name] of cases) {
      const opts = { ...baseOpts, [flag]: true };
      const checker = CHECKERS.find(c => c.name === name)!;
      expect(checker.enabled(opts)).toBe(false);
      // Disabling one checker must not disable the others.
      for (const other of CHECKERS.filter(c => c.name !== name)) {
        expect(other.enabled(opts)).toBe(true);
      }
    }
  });
});
