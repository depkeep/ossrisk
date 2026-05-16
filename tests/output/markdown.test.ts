import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../src/output/markdown.js';
import type { ScanResult } from '../../src/types.js';

const base: ScanResult = {
  scannedAt: '2026-01-01T00:00:00.000Z',
  manifest: '/project/package.json',
  results: [],
  summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, clean: 0 },
};

describe('renderMarkdown', () => {
  it('shows clean message when no risky deps', () => {
    const out = renderMarkdown(base);
    expect(out).toContain('✅ All dependencies are healthy.');
  });

  it('shows table header for risky deps', () => {
    const out = renderMarkdown({
      ...base,
      results: [{
        name: 'lodash', version: '4.17.11', ecosystem: 'npm',
        riskLevel: 'critical',
        signals: [{ type: 'cve', id: 'CVE-2021-23337', severity: 'critical', summary: 'Prototype pollution' }],
      }],
      summary: { total: 1, critical: 1, high: 0, medium: 0, low: 0, clean: 0 },
    });
    expect(out).toContain('| Package |');
    expect(out).toContain('lodash');
    expect(out).toContain('CVE-2021-23337');
    expect(out).toContain('Prototype pollution');
  });

  it('formats eol signal', () => {
    const out = renderMarkdown({
      ...base,
      results: [{
        name: 'django', version: '3.2.0', ecosystem: 'pypi',
        riskLevel: 'high',
        signals: [{ type: 'eol', cycle: '3.2', eolDate: '2024-04-01' }],
      }],
      summary: { total: 1, critical: 0, high: 1, medium: 0, low: 0, clean: 0 },
    });
    expect(out).toContain('EOL since 2024-04-01');
    expect(out).toContain('3.2');
  });

  it('formats abandoned signal', () => {
    const out = renderMarkdown({
      ...base,
      results: [{
        name: 'old-pkg', version: '1.0.0', ecosystem: 'npm',
        riskLevel: 'medium',
        signals: [{ type: 'abandoned', lastReleaseDate: '2022-01-01', monthsSince: 30 }],
      }],
      summary: { total: 1, critical: 0, high: 0, medium: 1, low: 0, clean: 0 },
    });
    expect(out).toContain('30 months');
    expect(out).toContain('2022-01-01');
  });

  it('formats stale signal', () => {
    const out = renderMarkdown({
      ...base,
      results: [{
        name: 'stale-pkg', version: '1.0.0', ecosystem: 'npm',
        riskLevel: 'low',
        signals: [{ type: 'stale', lastReleaseDate: '2024-06-01', monthsSince: 14 }],
      }],
      summary: { total: 1, critical: 0, high: 0, medium: 0, low: 1, clean: 0 },
    });
    expect(out).toContain('14 months ago');
  });

  it('formats outdated signal', () => {
    const out = renderMarkdown({
      ...base,
      results: [{
        name: 'express', version: '4.18.2', ecosystem: 'npm',
        riskLevel: 'low',
        signals: [{ type: 'outdated', latestVersion: '5.0.0' }],
      }],
      summary: { total: 1, critical: 0, high: 0, medium: 0, low: 1, clean: 0 },
    });
    expect(out).toContain('5.0.0');
  });

  it('includes summary counts', () => {
    const out = renderMarkdown({
      ...base,
      results: [],
      summary: { total: 10, critical: 1, high: 2, medium: 3, low: 1, clean: 3 },
    });
    expect(out).toContain('10 dependencies');
  });
});
