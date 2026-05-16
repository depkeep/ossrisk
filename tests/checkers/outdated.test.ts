import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkOutdated } from '../../src/checkers/outdated.js';
import type { Dependency } from '../../src/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('checkOutdated', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns outdated signal when a newer version exists', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ version: '5.0.0' }),
    });
    const dep: Dependency = { name: 'express', version: '4.18.2', ecosystem: 'npm' };
    const signals = await checkOutdated(dep);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual({ type: 'outdated', latestVersion: '5.0.0' });
  });

  it('returns empty when already at the latest version', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ version: '4.18.2' }),
    });
    const dep: Dependency = { name: 'express', version: '4.18.2', ecosystem: 'npm' };
    const signals = await checkOutdated(dep);
    expect(signals).toEqual([]);
  });

  it('returns empty on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const dep: Dependency = { name: 'express', version: '4.18.2', ecosystem: 'npm' };
    const signals = await checkOutdated(dep);
    expect(signals).toEqual([]);
  });

  it('returns empty when registry returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const dep: Dependency = { name: 'express', version: '4.18.2', ecosystem: 'npm' };
    const signals = await checkOutdated(dep);
    expect(signals).toEqual([]);
  });

  it('returns empty for unsupported ecosystem without calling fetch', async () => {
    const dep: Dependency = { name: 'some-crate', version: '1.0.0', ecosystem: 'cargo' };
    const signals = await checkOutdated(dep);
    expect(signals).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('checks PyPI for pypi ecosystem', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ info: { version: '3.0.0' } }),
    });
    const dep: Dependency = { name: 'requests', version: '2.31.0', ecosystem: 'pypi' };
    const signals = await checkOutdated(dep);
    expect(signals[0]).toEqual({ type: 'outdated', latestVersion: '3.0.0' });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('pypi.org'));
  });
});
