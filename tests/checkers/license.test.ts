import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkLicense } from '../../src/checkers/license.js';
import type { Dependency } from '../../src/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function npmRes(license: unknown) {
  return { ok: true, json: async () => ({ license }) };
}

function pypiRes(info: Record<string, unknown>) {
  return { ok: true, json: async () => ({ info }) };
}

const npmDep: Dependency = { name: 'pkg', version: '1.0.0', ecosystem: 'npm' };
const pypiDep: Dependency = { name: 'pkg', version: '1.0.0', ecosystem: 'pypi' };

describe('checkLicense', () => {
  beforeEach(() => mockFetch.mockReset());

  it('does not flag permissive npm licenses (MIT)', async () => {
    mockFetch.mockResolvedValue(npmRes('MIT'));
    expect(await checkLicense(npmDep)).toEqual([]);
  });

  it('flags GPL-3.0 as strong copyleft', async () => {
    mockFetch.mockResolvedValue(npmRes('GPL-3.0'));
    const signals = await checkLicense(npmDep);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('license');
    expect(signals[0].category).toBe('strong-copyleft');
    expect(signals[0].license).toBe('GPL-3.0');
  });

  it('flags AGPL as strong copyleft', async () => {
    mockFetch.mockResolvedValue(npmRes('AGPL-3.0-or-later'));
    const signals = await checkLicense(npmDep);
    expect(signals[0]?.category).toBe('strong-copyleft');
  });

  it('flags LGPL as weak copyleft', async () => {
    mockFetch.mockResolvedValue(npmRes('LGPL-3.0'));
    const signals = await checkLicense(npmDep);
    expect(signals[0]?.category).toBe('weak-copyleft');
  });

  it('flags MPL-2.0 as weak copyleft', async () => {
    mockFetch.mockResolvedValue(npmRes('MPL-2.0'));
    const signals = await checkLicense(npmDep);
    expect(signals[0]?.category).toBe('weak-copyleft');
  });

  it('flags missing npm license as unknown', async () => {
    mockFetch.mockResolvedValue(npmRes(undefined));
    const signals = await checkLicense(npmDep);
    expect(signals[0]?.category).toBe('unknown');
  });

  it('flags UNKNOWN string as unknown', async () => {
    mockFetch.mockResolvedValue(npmRes('UNKNOWN'));
    const signals = await checkLicense(npmDep);
    expect(signals[0]?.category).toBe('unknown');
  });

  it('handles the legacy object form ({ type: "GPL-3.0" })', async () => {
    mockFetch.mockResolvedValue(npmRes({ type: 'GPL-3.0' }));
    const signals = await checkLicense(npmDep);
    expect(signals[0]?.category).toBe('strong-copyleft');
  });

  it('normalizes "GPLv3" variants to SPDX', async () => {
    mockFetch.mockResolvedValue(npmRes('GPLv3'));
    const signals = await checkLicense(npmDep);
    expect(signals[0]?.category).toBe('strong-copyleft');
    expect(signals[0]?.license).toBe('GPL-3.0');
  });

  it('prefers PyPI classifiers over the freeform license field', async () => {
    mockFetch.mockResolvedValue(pypiRes({
      license: 'A long paragraph of license text that exceeds 80 chars and would not match SPDX',
      classifiers: ['License :: OSI Approved :: GNU General Public License v3 (GPLv3)'],
    }));
    const signals = await checkLicense(pypiDep);
    expect(signals[0]?.license).toBe('GPL-3.0');
    expect(signals[0]?.category).toBe('strong-copyleft');
  });

  it('falls back to PyPI freeform license when no classifier matches', async () => {
    mockFetch.mockResolvedValue(pypiRes({ license: 'MIT' }));
    expect(await checkLicense(pypiDep)).toEqual([]);
  });

  it('does not flag permissive PyPI license from classifier', async () => {
    mockFetch.mockResolvedValue(pypiRes({
      classifiers: ['License :: OSI Approved :: MIT License'],
    }));
    expect(await checkLicense(pypiDep)).toEqual([]);
  });

  it('returns unknown when registry responds non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const signals = await checkLicense(npmDep);
    expect(signals).toHaveLength(1);
    expect(signals[0].category).toBe('unknown');
  });

  it('skips unsupported ecosystems without calling fetch', async () => {
    const dep: Dependency = { name: 'pkg', version: '1.0.0', ecosystem: 'cargo' };
    expect(await checkLicense(dep)).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
