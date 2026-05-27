import { describe, it, expect } from 'vitest';
import { checkTyposquat } from '../../src/checkers/typosquat.js';
import type { Dependency } from '../../src/types.js';

function npm(name: string): Dependency {
  return { name, version: '1.0.0', ecosystem: 'npm' };
}

function pypi(name: string): Dependency {
  return { name, version: '1.0.0', ecosystem: 'pypi' };
}

describe('checkTyposquat', () => {
  it('flags a single-character edit-distance match against a popular npm package', () => {
    const signals = checkTyposquat(npm('lodahs'));
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('typosquat');
    expect(signals[0].suspectedTarget).toBe('lodash');
    expect(signals[0].reason).toBe('edit-distance');
    expect(signals[0].distance).toBe(1);
  });

  it('flags a two-character edit-distance match', () => {
    const signals = checkTyposquat(npm('expres'));
    expect(signals[0]?.suspectedTarget).toBe('express');
  });

  it('flags an rn/m homoglyph attack', () => {
    // Attacker uses `rn` to mimic `m` in `commander` → `cornmander`.
    const signals = checkTyposquat(npm('cornmander'));
    expect(signals).toHaveLength(1);
    expect(signals[0].reason).toBe('homoglyph');
    expect(signals[0].suspectedTarget).toBe('commander');
  });

  it('does not flag a popular package as a typosquat of itself', () => {
    expect(checkTyposquat(npm('lodash'))).toEqual([]);
    expect(checkTyposquat(npm('react'))).toEqual([]);
    expect(checkTyposquat(npm('express'))).toEqual([]);
  });

  it('does not flag short names (under 4 chars)', () => {
    expect(checkTyposquat(npm('abc'))).toEqual([]);
    expect(checkTyposquat(npm('xy'))).toEqual([]);
  });

  it('does not flag wholly unrelated names', () => {
    expect(checkTyposquat(npm('zzzzz-unrelated-package'))).toEqual([]);
    expect(checkTyposquat(npm('my-internal-thing'))).toEqual([]);
  });

  it('flags PyPI typosquats', () => {
    const signals = checkTyposquat(pypi('reqests'));
    expect(signals[0]?.suspectedTarget).toBe('requests');
  });

  it('does not flag popular PyPI packages', () => {
    expect(checkTyposquat(pypi('requests'))).toEqual([]);
    expect(checkTyposquat(pypi('numpy'))).toEqual([]);
  });

  it('does not flag scoped npm packages against unscoped popular targets', () => {
    // npm scopes have verified ownership, so basename-vs-unscoped comparison
    // is the wrong signal. Scope-confusion attacks (@bable/lodash) need
    // per-scope reputation data we don't have. See checkTyposquat for detail.
    expect(checkTyposquat(npm('@evil/lodash'))).toEqual([]);
    expect(checkTyposquat(npm('@evil/lodahs'))).toEqual([]);
    expect(checkTyposquat(npm('@astrojs/prism'))).toEqual([]);
    expect(checkTyposquat(npm('@babel/parser'))).toEqual([]);
    expect(checkTyposquat(npm('@floating-ui/core'))).toEqual([]);
    expect(checkTyposquat(npm('@types/hast'))).toEqual([]);
  });

  it('requires an exact distance-1 match for short names', () => {
    // Distance 2 across 4-5 char names was producing many false positives
    // (asap/tsup, jose/core, vfile/vite, regex/remix, defu/debug). Distance
    // 1 typos at short lengths are still caught.
    expect(checkTyposquat(npm('asap'))).toEqual([]);
    expect(checkTyposquat(npm('clsx'))).toEqual([]);
    expect(checkTyposquat(npm('vfile'))).toEqual([]);
    expect(checkTyposquat(npm('regex'))).toEqual([]);
    expect(checkTyposquat(npm('defu'))).toEqual([]);
    expect(checkTyposquat(npm('nise'))).toEqual([]);
    expect(checkTyposquat(npm('parse5'))).toEqual([]);
    // But distance-1 short typos are still flagged
    const signals = checkTyposquat(npm('lodsh'));
    expect(signals[0]?.suspectedTarget).toBe('lodash');
  });

  it('returns empty for unsupported ecosystems', () => {
    const dep: Dependency = { name: 'something', version: '1.0.0', ecosystem: 'cargo' };
    expect(checkTyposquat(dep)).toEqual([]);
  });

  it('does not produce duplicate matches for one dependency', () => {
    const signals = checkTyposquat(npm('lodahs'));
    expect(signals.length).toBeLessThanOrEqual(1);
  });
});
