import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkActivity } from '../../src/checkers/activity.js';
import type { Dependency } from '../../src/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

describe('checkActivity', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns abandoned signal for >24 months without a release', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ time: { modified: monthsAgo(30) } }),
    });
    const dep: Dependency = { name: 'ancient-lib', version: '1.0.0', ecosystem: 'npm' };
    const signals = await checkActivity(dep);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('abandoned');
    expect((signals[0] as { monthsSince: number }).monthsSince).toBeGreaterThanOrEqual(24);
  });

  it('returns stale signal for 12–24 months without a release', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ time: { modified: monthsAgo(18) } }),
    });
    const dep: Dependency = { name: 'stale-lib', version: '1.0.0', ecosystem: 'npm' };
    const signals = await checkActivity(dep);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('stale');
  });

  it('returns empty for recently updated package (<12 months)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ time: { modified: monthsAgo(3) } }),
    });
    const dep: Dependency = { name: 'fresh-lib', version: '1.0.0', ecosystem: 'npm' };
    const signals = await checkActivity(dep);
    expect(signals).toEqual([]);
  });

  it('returns empty on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const dep: Dependency = { name: 'any-lib', version: '1.0.0', ecosystem: 'npm' };
    const signals = await checkActivity(dep);
    expect(signals).toEqual([]);
  });

  it('returns empty when registry returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const dep: Dependency = { name: 'any-lib', version: '1.0.0', ecosystem: 'npm' };
    const signals = await checkActivity(dep);
    expect(signals).toEqual([]);
  });

  it('skips unsupported ecosystems without calling fetch', async () => {
    const dep: Dependency = { name: 'some-crate', version: '1.0.0', ecosystem: 'cargo' };
    const signals = await checkActivity(dep);
    expect(signals).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('includes lastReleaseDate and monthsSince in signal', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ time: { modified: monthsAgo(30) } }),
    });
    const dep: Dependency = { name: 'ancient-lib', version: '1.0.0', ecosystem: 'npm' };
    const signals = await checkActivity(dep);
    const signal = signals[0] as { type: string; lastReleaseDate: string; monthsSince: number };
    expect(signal.lastReleaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(signal.monthsSince).toBeGreaterThan(0);
  });
});
