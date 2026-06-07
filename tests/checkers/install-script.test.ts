import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkInstallScript } from '../../src/checkers/install-script.js';
import type { Dependency } from '../../src/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function npmRes(body: unknown) {
  return { ok: true, json: async () => body };
}

const npmDep: Dependency = { name: 'evil-pkg', version: '1.0.0', ecosystem: 'npm', isDirect: true };
const pypiDep: Dependency = { name: 'requests', version: '2.28.0', ecosystem: 'pypi', isDirect: true };

describe('checkInstallScript', () => {
  beforeEach(() => mockFetch.mockReset());

  it('flags postinstall hook', async () => {
    mockFetch.mockResolvedValue(npmRes({ scripts: { postinstall: 'node ./setup.js' } }));
    const signals = await checkInstallScript(npmDep);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('install-script');
    expect(signals[0].hooks).toContain('postinstall');
  });

  it('flags preinstall hook', async () => {
    mockFetch.mockResolvedValue(npmRes({ scripts: { preinstall: 'bash ./pre.sh' } }));
    const signals = await checkInstallScript(npmDep);
    expect(signals).toHaveLength(1);
    expect(signals[0].hooks).toContain('preinstall');
  });

  it('flags install hook', async () => {
    mockFetch.mockResolvedValue(npmRes({ scripts: { install: 'node-gyp rebuild' } }));
    const signals = await checkInstallScript(npmDep);
    expect(signals).toHaveLength(1);
    expect(signals[0].hooks).toContain('install');
  });

  it('reports all matching hooks in a single signal', async () => {
    mockFetch.mockResolvedValue(npmRes({
      scripts: { preinstall: 'echo pre', postinstall: 'echo post', test: 'vitest' },
    }));
    const signals = await checkInstallScript(npmDep);
    expect(signals).toHaveLength(1);
    expect(signals[0].hooks).toEqual(expect.arrayContaining(['preinstall', 'postinstall']));
    expect(signals[0].hooks).not.toContain('test');
  });

  it('returns empty array when no install hooks are present', async () => {
    mockFetch.mockResolvedValue(npmRes({ scripts: { test: 'vitest', build: 'tsc' } }));
    const signals = await checkInstallScript(npmDep);
    expect(signals).toHaveLength(0);
  });

  it('returns empty array when scripts field is absent', async () => {
    mockFetch.mockResolvedValue(npmRes({ name: 'evil-pkg', version: '1.0.0' }));
    const signals = await checkInstallScript(npmDep);
    expect(signals).toHaveLength(0);
  });

  it('returns empty array for PyPI packages without calling fetch', async () => {
    const signals = await checkInstallScript(pypiDep);
    expect(signals).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array when registry returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    const signals = await checkInstallScript(npmDep);
    expect(signals).toHaveLength(0);
  });

  it('returns empty array when json parsing throws', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => { throw new Error('parse error'); },
    });
    const signals = await checkInstallScript(npmDep);
    expect(signals).toHaveLength(0);
  });

  it('uses the correct version-specific npm registry URL', async () => {
    mockFetch.mockResolvedValue(npmRes({ scripts: {} }));
    await checkInstallScript(npmDep);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://registry.npmjs.org/evil-pkg/1.0.0`,
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) })
    );
  });
});
