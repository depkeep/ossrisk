import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkEol } from '../../src/checkers/eol.js';
import type { Dependency } from '../../src/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const nodeDep: Dependency = { name: 'node', version: '14.21.3', ecosystem: 'npm' };

describe('checkEol', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns empty for unknown package (not in EOL_MAP)', async () => {
    const dep: Dependency = { name: 'some-unknown-lib', version: '1.0.0', ecosystem: 'npm' };
    const signals = await checkEol(dep);
    expect(signals).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty when cycle is still supported (eol=false)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ cycle: '14', eol: false }],
    });
    const signals = await checkEol(nodeDep);
    expect(signals).toEqual([]);
  });

  it('returns eol signal for a past EOL date', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ cycle: '14', eol: '2023-04-30' }],
    });
    const signals = await checkEol(nodeDep);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('eol');
    expect(signals[0].eolDate).toBe('2023-04-30');
    expect(signals[0].cycle).toBe('14');
  });

  it('returns eol signal when eol=true', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ cycle: '14', eol: true }],
    });
    const signals = await checkEol(nodeDep);
    expect(signals).toHaveLength(1);
    expect(signals[0].eolDate).toBe('unknown');
  });

  it('returns empty for a future EOL date', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ cycle: '14', eol: '2099-01-01' }],
    });
    const signals = await checkEol(nodeDep);
    expect(signals).toEqual([]);
  });

  it('returns empty on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const signals = await checkEol(nodeDep);
    expect(signals).toEqual([]);
  });

  it('returns empty when API returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const signals = await checkEol(nodeDep);
    expect(signals).toEqual([]);
  });

  it('tries major.minor cycle before major-only', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { cycle: '14.21', eol: '2023-04-30' },
        { cycle: '14', eol: false },
      ],
    });
    const signals = await checkEol(nodeDep);
    expect(signals[0].cycle).toBe('14.21');
  });

  it('falls back to major cycle when major.minor not found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ cycle: '14', eol: '2023-04-30' }],
    });
    const signals = await checkEol(nodeDep);
    expect(signals[0].cycle).toBe('14');
  });

  it('resolves package aliases (next → nextjs)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ cycle: '12', eol: '2023-10-26' }],
    });
    const dep: Dependency = { name: 'next', version: '12.3.4', ecosystem: 'npm' };
    const signals = await checkEol(dep);
    expect(signals).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('nextjs'));
  });
});
