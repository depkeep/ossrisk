import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkCvesBatch } from '../../src/checkers/osv.js';
import type { Dependency } from '../../src/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const deps: Dependency[] = [
  { name: 'lodash', version: '4.17.11', ecosystem: 'npm' },
  { name: 'express', version: '4.18.2', ecosystem: 'npm' },
];

describe('checkCvesBatch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('maps CVSS V3 score ≥9.0 to critical', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { vulns: [{ id: 'GHSA-test-1', summary: 'Proto pollution', severity: [{ type: 'CVSS_V3', score: '9.8' }] }] },
          { vulns: [] },
        ],
      }),
    });
    const map = await checkCvesBatch(deps);
    expect(map.get('lodash@4.17.11')?.[0].severity).toBe('critical');
  });

  it('maps CVSS V3 score 7.0–8.9 to high', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { vulns: [{ id: 'GHSA-test-2', summary: 'Test', severity: [{ type: 'CVSS_V3', score: '7.5' }] }] },
          { vulns: [] },
        ],
      }),
    });
    const map = await checkCvesBatch(deps);
    expect(map.get('lodash@4.17.11')?.[0].severity).toBe('high');
  });

  it('maps CVSS V3 score 4.0–6.9 to medium', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { vulns: [{ id: 'GHSA-test-3', summary: 'Test', severity: [{ type: 'CVSS_V3', score: '5.3' }] }] },
          { vulns: [] },
        ],
      }),
    });
    const map = await checkCvesBatch(deps);
    expect(map.get('lodash@4.17.11')?.[0].severity).toBe('medium');
  });

  it('falls back to database_specific severity when no CVSS score', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { vulns: [{ id: 'GHSA-test-4', summary: 'Test', database_specific: { severity: 'HIGH' } }] },
          { vulns: [] },
        ],
      }),
    });
    const map = await checkCvesBatch(deps);
    expect(map.get('lodash@4.17.11')?.[0].severity).toBe('high');
  });

  it('treats MODERATE as medium', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { vulns: [{ id: 'GHSA-test-5', summary: 'Test', database_specific: { severity: 'MODERATE' } }] },
          { vulns: [] },
        ],
      }),
    });
    const map = await checkCvesBatch(deps);
    expect(map.get('lodash@4.17.11')?.[0].severity).toBe('medium');
  });

  it('returns empty arrays for clean deps', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ vulns: [] }, { vulns: [] }] }),
    });
    const map = await checkCvesBatch(deps);
    expect(map.get('express@4.18.2')).toEqual([]);
  });

  it('includes CVE id and summary in results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { vulns: [{ id: 'GHSA-abc-123', summary: 'Remote code execution' }] },
          { vulns: [] },
        ],
      }),
    });
    const map = await checkCvesBatch(deps);
    const cve = map.get('lodash@4.17.11')?.[0];
    expect(cve?.id).toBe('GHSA-abc-123');
    expect(cve?.summary).toBe('Remote code execution');
  });

  it('returns empty map on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const map = await checkCvesBatch(deps);
    expect(map.size).toBe(0);
  });

  it('returns empty map on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const map = await checkCvesBatch(deps);
    expect(map.size).toBe(0);
  });
});
