import { describe, it, expect } from 'vitest';
import { renderTable } from '../../src/output/table.js';
import type { ScanResult } from '../../src/types.js';

const base: ScanResult = {
  scannedAt: '2026-01-01T00:00:00.000Z',
  manifest: '/project/package.json',
  results: [],
  summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, clean: 0 },
};

describe('renderTable', () => {
  it('renders without throwing for empty results', () => {
    expect(() => renderTable(base)).not.toThrow();
  });

  it('includes manifest path', () => {
    const out = renderTable(base);
    expect(out).toContain('/project/package.json');
  });

  it('renders package name and version for risky dep', () => {
    const out = renderTable({
      ...base,
      results: [{
        name: 'lodash', version: '4.17.11', ecosystem: 'npm',
        riskLevel: 'critical',
        signals: [{ type: 'cve', id: 'CVE-2021-23337', severity: 'critical', summary: 'Prototype pollution' }],
      }],
      summary: { total: 1, critical: 1, high: 0, medium: 0, low: 0, clean: 0 },
    });
    expect(out).toContain('lodash');
    expect(out).toContain('4.17.11');
    expect(out).toContain('CVE-2021-23337');
  });

  it('renders all signal types in detail column', () => {
    const out = renderTable({
      ...base,
      results: [
        {
          name: 'pkg-a', version: '1.0.0', ecosystem: 'npm', riskLevel: 'high',
          signals: [{ type: 'eol', cycle: '1', eolDate: '2023-01-01' }],
        },
        {
          name: 'pkg-b', version: '2.0.0', ecosystem: 'npm', riskLevel: 'medium',
          signals: [{ type: 'abandoned', lastReleaseDate: '2022-01-01', monthsSince: 30 }],
        },
        {
          name: 'pkg-c', version: '3.0.0', ecosystem: 'npm', riskLevel: 'low',
          signals: [{ type: 'outdated', latestVersion: '4.0.0' }],
        },
      ],
      summary: { total: 3, critical: 0, high: 1, medium: 1, low: 1, clean: 0 },
    });
    expect(out).toContain('EOL');
    expect(out).toContain('30mo');
    expect(out).toContain('4.0.0');
  });

  it('renders clean deps with dim styling', () => {
    const out = renderTable({
      ...base,
      results: [{
        name: 'safe-pkg', version: '1.0.0', ecosystem: 'npm',
        riskLevel: 'none',
        signals: [],
      }],
      summary: { total: 1, critical: 0, high: 0, medium: 0, low: 0, clean: 1 },
    });
    expect(out).toContain('safe-pkg');
  });
});
