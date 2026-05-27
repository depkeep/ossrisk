import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkMaintainer } from '../../src/checkers/maintainer.js';
import type { Dependency } from '../../src/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function npmRes(body: unknown) {
  return { ok: true, json: async () => body };
}

const dep: Dependency = { name: 'pkg', version: '1.0.0', ecosystem: 'npm', isDirect: true };

describe('checkMaintainer', () => {
  beforeEach(() => mockFetch.mockReset());

  it('flags new-publisher when latest publisher is absent from the early releases', async () => {
    mockFetch.mockResolvedValue(npmRes({
      maintainers: [{ name: 'alice' }, { name: 'eve' }],
      'dist-tags': { latest: '1.5.0' },
      time: {
        created: daysAgo(800),
        '1.0.0': daysAgo(700),
        '1.1.0': daysAgo(600),
        '1.2.0': daysAgo(500),
        '1.3.0': daysAgo(100),
        '1.5.0': daysAgo(2),
      },
      versions: {
        '1.0.0': { _npmUser: { name: 'alice' } },
        '1.1.0': { _npmUser: { name: 'alice' } },
        '1.2.0': { _npmUser: { name: 'alice' } },
        '1.3.0': { _npmUser: { name: 'alice' } },
        '1.5.0': { _npmUser: { name: 'eve' } },
      },
    }));
    const signals = await checkMaintainer(dep);
    expect(signals.some(s => s.pattern === 'new-publisher')).toBe(true);
  });

  it('does not flag new-publisher when latest publisher is one of the original publishers', async () => {
    mockFetch.mockResolvedValue(npmRes({
      maintainers: [{ name: 'alice' }, { name: 'bob' }],
      'dist-tags': { latest: '1.5.0' },
      time: {
        created: daysAgo(800),
        '1.0.0': daysAgo(700),
        '1.1.0': daysAgo(600),
        '1.2.0': daysAgo(500),
        '1.5.0': daysAgo(10),
      },
      versions: {
        '1.0.0': { _npmUser: { name: 'alice' } },
        '1.1.0': { _npmUser: { name: 'bob' } },
        '1.2.0': { _npmUser: { name: 'alice' } },
        '1.5.0': { _npmUser: { name: 'alice' } },
      },
    }));
    const signals = await checkMaintainer(dep);
    expect(signals.some(s => s.pattern === 'new-publisher')).toBe(false);
  });

  it('does not flag new-publisher on a young package', async () => {
    mockFetch.mockResolvedValue(npmRes({
      maintainers: [{ name: 'alice' }, { name: 'eve' }],
      'dist-tags': { latest: '1.5.0' },
      time: {
        created: daysAgo(30),
        '1.0.0': daysAgo(28),
        '1.1.0': daysAgo(20),
        '1.2.0': daysAgo(10),
        '1.5.0': daysAgo(2),
      },
      versions: {
        '1.0.0': { _npmUser: { name: 'alice' } },
        '1.1.0': { _npmUser: { name: 'alice' } },
        '1.2.0': { _npmUser: { name: 'alice' } },
        '1.5.0': { _npmUser: { name: 'eve' } },
      },
    }));
    const signals = await checkMaintainer(dep);
    expect(signals.some(s => s.pattern === 'new-publisher')).toBe(false);
  });

  it('does not flag new-publisher when there are too few historical releases', async () => {
    mockFetch.mockResolvedValue(npmRes({
      maintainers: [{ name: 'alice' }],
      'dist-tags': { latest: '1.1.0' },
      time: {
        created: daysAgo(400),
        '1.0.0': daysAgo(400),
        '1.1.0': daysAgo(10),
      },
      versions: {
        '1.0.0': { _npmUser: { name: 'alice' } },
        '1.1.0': { _npmUser: { name: 'eve' } },
      },
    }));
    const signals = await checkMaintainer(dep);
    expect(signals.some(s => s.pattern === 'new-publisher')).toBe(false);
  });

  it('flags sole-maintainer when only one maintainer is registered', async () => {
    mockFetch.mockResolvedValue(npmRes({
      maintainers: [{ name: 'alice' }],
      time: { created: daysAgo(100) },
      versions: {},
    }));
    const signals = await checkMaintainer(dep);
    expect(signals.some(s => s.pattern === 'sole-maintainer')).toBe(true);
  });

  it('does not flag sole-maintainer when multiple maintainers exist', async () => {
    mockFetch.mockResolvedValue(npmRes({
      maintainers: [{ name: 'alice' }, { name: 'bob' }],
      time: { created: daysAgo(100) },
      versions: {},
    }));
    const signals = await checkMaintainer(dep);
    expect(signals.some(s => s.pattern === 'sole-maintainer')).toBe(false);
  });

  it('can emit both signals at once', async () => {
    mockFetch.mockResolvedValue(npmRes({
      maintainers: [{ name: 'eve' }],
      'dist-tags': { latest: '1.5.0' },
      time: {
        created: daysAgo(800),
        '1.0.0': daysAgo(700),
        '1.1.0': daysAgo(600),
        '1.2.0': daysAgo(500),
        '1.5.0': daysAgo(2),
      },
      versions: {
        '1.0.0': { _npmUser: { name: 'alice' } },
        '1.1.0': { _npmUser: { name: 'alice' } },
        '1.2.0': { _npmUser: { name: 'alice' } },
        '1.5.0': { _npmUser: { name: 'eve' } },
      },
    }));
    const signals = await checkMaintainer(dep);
    expect(signals.map(s => s.pattern).sort()).toEqual(['new-publisher', 'sole-maintainer']);
  });

  it('returns empty for non-npm ecosystems', async () => {
    const pypiDep: Dependency = { name: 'pkg', version: '1.0.0', ecosystem: 'pypi', isDirect: true };
    expect(await checkMaintainer(pypiDep)).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty when the registry responds non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    expect(await checkMaintainer(dep)).toEqual([]);
  });

  it('returns empty when versions lack _npmUser fields', async () => {
    mockFetch.mockResolvedValue(npmRes({
      maintainers: [{ name: 'alice' }, { name: 'bob' }],
      'dist-tags': { latest: '1.5.0' },
      time: {
        created: daysAgo(800),
        '1.0.0': daysAgo(700),
        '1.1.0': daysAgo(600),
        '1.2.0': daysAgo(500),
        '1.5.0': daysAgo(10),
      },
      versions: {
        '1.0.0': {}, '1.1.0': {}, '1.2.0': {}, '1.5.0': {},
      },
    }));
    expect(await checkMaintainer(dep)).toEqual([]);
  });
});
