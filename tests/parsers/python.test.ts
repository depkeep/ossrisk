import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { parsePython } from '../../src/parsers/python.js';

describe('parsePython', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ossrisk-py-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  it('parses == pinned versions', async () => {
    await writeFile(join(dir, 'requirements.txt'), 'Django==4.2.0\nrequests==2.31.0\n');
    const deps = await parsePython(dir);
    expect(deps.find(d => d.name === 'django')?.version).toBe('4.2.0');
    expect(deps.find(d => d.name === 'requests')?.version).toBe('2.31.0');
  });

  it('parses >= and ~= versions', async () => {
    await writeFile(join(dir, 'requirements.txt'), 'flask>=2.3.0\ncelery~=5.3.1\n');
    const deps = await parsePython(dir);
    expect(deps.find(d => d.name === 'flask')?.version).toBe('2.3.0');
    expect(deps.find(d => d.name === 'celery')?.version).toBe('5.3.1');
  });

  it('normalizes underscores to dashes in package names', async () => {
    await writeFile(join(dir, 'requirements.txt'), 'my_package==1.0.0\n');
    const deps = await parsePython(dir);
    expect(deps[0].name).toBe('my-package');
  });

  it('lowercases package names', async () => {
    await writeFile(join(dir, 'requirements.txt'), 'Django==4.2.0\n');
    const deps = await parsePython(dir);
    expect(deps[0].name).toBe('django');
  });

  it('skips comment lines', async () => {
    await writeFile(join(dir, 'requirements.txt'), '# comment\nrequests==2.31.0\n# another\n');
    const deps = await parsePython(dir);
    expect(deps).toHaveLength(1);
  });

  it('skips blank lines', async () => {
    await writeFile(join(dir, 'requirements.txt'), '\nrequests==2.31.0\n\n');
    const deps = await parsePython(dir);
    expect(deps).toHaveLength(1);
  });

  it('skips -r and -c flags', async () => {
    await writeFile(join(dir, 'requirements.txt'), '-r other.txt\nrequests==2.31.0\n');
    const deps = await parsePython(dir);
    expect(deps).toHaveLength(1);
    expect(deps[0].name).toBe('requests');
  });

  it('ignores inline comments', async () => {
    await writeFile(join(dir, 'requirements.txt'), 'requests==2.31.0  # http library\n');
    const deps = await parsePython(dir);
    expect(deps[0].version).toBe('2.31.0');
  });

  it('sets ecosystem to pypi', async () => {
    await writeFile(join(dir, 'requirements.txt'), 'requests==2.31.0\n');
    const deps = await parsePython(dir);
    expect(deps[0].ecosystem).toBe('pypi');
  });

  it('parses Pipfile.lock when present and prefers it over requirements.txt', async () => {
    await writeFile(join(dir, 'requirements.txt'), 'flask==2.0.0\n');
    await writeFile(join(dir, 'Pipfile.lock'), JSON.stringify({
      _meta: { pipfile: { packages: { requests: '*' } } },
      default: {
        requests: { version: '==2.31.0' },
        urllib3:  { version: '==2.0.7' },
      },
    }));
    const deps = await parsePython(dir);
    const names = deps.map(d => d.name).sort();
    expect(names).toEqual(['requests', 'urllib3']);
    expect(names).not.toContain('flask');
  });

  it('marks Pipfile.lock entries as direct vs transitive using _meta.pipfile.packages', async () => {
    await writeFile(join(dir, 'Pipfile.lock'), JSON.stringify({
      _meta: { pipfile: { packages: { requests: '*' } } },
      default: {
        requests: { version: '==2.31.0' },
        urllib3:  { version: '==2.0.7' },
      },
    }));
    const deps = await parsePython(dir);
    expect(deps.find(d => d.name === 'requests')?.isDirect).toBe(true);
    expect(deps.find(d => d.name === 'urllib3')?.isDirect).toBe(false);
  });

  it('falls back to marking everything direct when Pipfile section is missing', async () => {
    await writeFile(join(dir, 'Pipfile.lock'), JSON.stringify({
      default: { requests: { version: '==2.31.0' }, urllib3: { version: '==2.0.7' } },
    }));
    const deps = await parsePython(dir);
    expect(deps.every(d => d.isDirect)).toBe(true);
  });

  it('marks requirements.txt entries as direct', async () => {
    await writeFile(join(dir, 'requirements.txt'), 'requests==2.31.0\n');
    const deps = await parsePython(dir);
    expect(deps[0].isDirect).toBe(true);
  });
});
