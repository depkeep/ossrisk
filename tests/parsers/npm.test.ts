import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseNpm } from '../../src/parsers/npm.js';

describe('parseNpm', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ossrisk-npm-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  it('parses dependencies from package.json when no lockfile', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      dependencies: { express: '^4.18.2', lodash: '~4.17.0' },
    }));
    const deps = await parseNpm(dir);
    expect(deps).toHaveLength(2);
    expect(deps.find(d => d.name === 'express')?.version).toBe('4.18.2');
    expect(deps.find(d => d.name === 'lodash')?.version).toBe('4.17.0');
  });

  it('prefers lockfile over package.json', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      dependencies: { express: '^4.17.0' },
    }));
    await writeFile(join(dir, 'package-lock.json'), JSON.stringify({
      packages: {
        '': {},
        'node_modules/express': { version: '4.18.2' },
      },
    }));
    const deps = await parseNpm(dir);
    expect(deps).toHaveLength(1);
    expect(deps[0].version).toBe('4.18.2');
  });

  it('excludes dev dependencies from lockfile', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ dependencies: {} }));
    await writeFile(join(dir, 'package-lock.json'), JSON.stringify({
      packages: {
        '': {},
        'node_modules/express': { version: '4.18.2' },
        'node_modules/vitest': { version: '2.0.0', dev: true },
      },
    }));
    const deps = await parseNpm(dir);
    expect(deps.some(d => d.name === 'vitest')).toBe(false);
    expect(deps.some(d => d.name === 'express')).toBe(true);
  });

  it('strips all common version range operators', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      dependencies: {
        a: '^1.2.3',
        b: '~2.0.0',
        c: '>=3.0.0',
        d: '1.0.0',
      },
    }));
    const deps = await parseNpm(dir);
    expect(deps.find(d => d.name === 'a')?.version).toBe('1.2.3');
    expect(deps.find(d => d.name === 'b')?.version).toBe('2.0.0');
    expect(deps.find(d => d.name === 'c')?.version).toBe('3.0.0');
    expect(deps.find(d => d.name === 'd')?.version).toBe('1.0.0');
  });

  it('excludes file: and github: specifiers', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      dependencies: {
        local: 'file:../local',
        ghpkg: 'github:user/repo',
        real: '1.0.0',
      },
    }));
    const deps = await parseNpm(dir);
    expect(deps.some(d => d.name === 'local')).toBe(false);
    expect(deps.some(d => d.name === 'ghpkg')).toBe(false);
    expect(deps.some(d => d.name === 'real')).toBe(true);
  });

  it('sets ecosystem to npm', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      dependencies: { express: '4.18.2' },
    }));
    const deps = await parseNpm(dir);
    expect(deps[0].ecosystem).toBe('npm');
  });

  it('marks root-listed packages as direct in the lockfile', async () => {
    await writeFile(join(dir, 'package-lock.json'), JSON.stringify({
      packages: {
        '': { dependencies: { express: '^4.18.2' } },
        'node_modules/express': { version: '4.18.2', dependencies: { accepts: '^1.3.8' } },
        'node_modules/accepts': { version: '1.3.8' },
      },
    }));
    const deps = await parseNpm(dir);
    expect(deps.find(d => d.name === 'express')?.isDirect).toBe(true);
    expect(deps.find(d => d.name === 'accepts')?.isDirect).toBe(false);
  });

  it('resolves via to the direct dep that pulls in a transitive', async () => {
    await writeFile(join(dir, 'package-lock.json'), JSON.stringify({
      packages: {
        '': { dependencies: { express: '^4.18.2' } },
        'node_modules/express': { version: '4.18.2', dependencies: { accepts: '^1.3.8' } },
        'node_modules/accepts': { version: '1.3.8', dependencies: { mime: '^1.6.0' } },
        'node_modules/mime': { version: '1.6.0' },
      },
    }));
    const deps = await parseNpm(dir);
    expect(deps.find(d => d.name === 'mime')?.via).toBe('express');
    expect(deps.find(d => d.name === 'accepts')?.via).toBe('express');
  });

  it('package.json-only fallback marks everything as direct', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      dependencies: { express: '^4.18.2' },
    }));
    const deps = await parseNpm(dir);
    expect(deps.every(d => d.isDirect)).toBe(true);
  });
});
