import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect, vi } from 'vitest';
import { assertOpaAvailable, evaluatePolicy, resolveOpaPath } from '../src/policy.js';
import type { RunOpa } from '../src/policy.js';
import type { ScanResult } from '../src/types.js';

const scanResult: ScanResult = {
  scannedAt: '2026-06-12T00:00:00.000Z',
  manifest: 'package.json',
  results: [
    {
      name: 'left-pad',
      version: '1.0.0',
      ecosystem: 'npm',
      riskLevel: 'high',
      signals: [{ type: 'cve', id: 'CVE-2026-0001', severity: 'critical', summary: 'bad' }],
      isDirect: true,
    },
  ],
  summary: { total: 1, critical: 0, high: 1, medium: 0, low: 0, clean: 0 },
};

function opaOutput(value: unknown) {
  return JSON.stringify({ result: [{ expressions: [{ value }] }] });
}

function runReturning(stdout: string): RunOpa {
  return vi.fn().mockResolvedValue({ code: 0, stdout, stderr: '' });
}

const OPA_BINARY = process.platform === 'win32' ? 'opa.exe' : 'opa';

function tempDirWithOpa(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ossrisk-opa-'));
  writeFileSync(join(dir, OPA_BINARY), '');
  return dir;
}

describe('resolveOpaPath', () => {
  it('finds opa on PATH', () => {
    const dir = tempDirWithOpa();
    const found = resolveOpaPath({ PATH: dir, PATHEXT: '.EXE' }, mkdtempSync(join(tmpdir(), 'ossrisk-cwd-')));
    expect(found).toBe(join(dir, OPA_BINARY));
  });

  it.runIf(process.platform === 'win32')('finds opa.exe in the current directory on Windows', () => {
    const cwd = tempDirWithOpa();
    const found = resolveOpaPath({ PATH: '', PATHEXT: '.EXE' }, cwd);
    expect(found).toBe(join(cwd, 'opa.exe'));
  });

  it('returns null when opa is nowhere to be found', () => {
    const empty = mkdtempSync(join(tmpdir(), 'ossrisk-empty-'));
    expect(resolveOpaPath({ PATH: empty, PATHEXT: '.EXE' }, empty)).toBeNull();
  });
});

describe('assertOpaAvailable', () => {
  it('resolves when the opa binary runs', async () => {
    const run: RunOpa = vi.fn().mockResolvedValue({ code: 0, stdout: 'Version: 1.0', stderr: '' });
    await expect(assertOpaAvailable(run)).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledWith(['version'], '', '.');
  });

  it('throws the install hint when the opa binary is missing', async () => {
    const run: RunOpa = vi
      .fn()
      .mockResolvedValue({ code: null, stdout: '', stderr: '', notFound: true });
    await expect(assertOpaAvailable(run)).rejects.toThrow(/requires the OPA CLI/);
  });
});

describe('evaluatePolicy', () => {
  it('returns deny messages from opa output', async () => {
    const run = runReturning(opaOutput(['left-pad@1.0.0 has critical CVE-2026-0001']));
    const violations = await evaluatePolicy(scanResult, '/p/policy.rego', run);
    expect(violations).toEqual(['left-pad@1.0.0 has critical CVE-2026-0001']);
  });

  it('returns empty array for an empty deny set', async () => {
    const run = runReturning(opaOutput([]));
    const violations = await evaluatePolicy(scanResult, '/p/policy.rego', run);
    expect(violations).toEqual([]);
  });

  it('invokes opa eval with the deny query, from the policy parent directory', async () => {
    const run = runReturning(opaOutput([]));
    await evaluatePolicy(scanResult, '/p/policies', run);
    // The policy path is split into cwd + basename so absolute Windows paths
    // never hit opa's `prefix:path` parsing of --data.
    expect(run).toHaveBeenCalledWith(
      ['eval', '--format', 'json', '--stdin-input', '--data', 'policies', 'data.ossrisk.deny'],
      expect.any(String),
      '/p'
    );
  });

  it('passes the scan result JSON on stdin verbatim', async () => {
    const run = runReturning(opaOutput([]));
    await evaluatePolicy(scanResult, '/p/policy.rego', run);
    const stdin = (run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(JSON.parse(stdin)).toEqual(scanResult);
  });

  it('throws an install hint when the opa binary is missing', async () => {
    const run: RunOpa = vi
      .fn()
      .mockResolvedValue({ code: null, stdout: '', stderr: '', notFound: true });
    await expect(evaluatePolicy(scanResult, '/p/policy.rego', run)).rejects.toThrow(
      /requires the OPA CLI/
    );
  });

  it('surfaces opa stderr when evaluation fails', async () => {
    const run: RunOpa = vi.fn().mockResolvedValue({
      code: 1,
      stdout: '',
      stderr: 'rego_parse_error: unexpected token',
    });
    await expect(evaluatePolicy(scanResult, '/p/policy.rego', run)).rejects.toThrow(
      /rego_parse_error/
    );
  });

  it('throws when the policy does not define data.ossrisk.deny', async () => {
    // opa eval reports an undefined document as an empty result array
    const run = runReturning(JSON.stringify({ result: [] }));
    await expect(evaluatePolicy(scanResult, '/p/policy.rego', run)).rejects.toThrow(
      /does not define data\.ossrisk\.deny/
    );
  });

  it('throws when deny evaluates to a non-array value', async () => {
    const run = runReturning(opaOutput('oops'));
    await expect(evaluatePolicy(scanResult, '/p/policy.rego', run)).rejects.toThrow(
      /must be a set/
    );
  });

  it('throws when opa output is not parseable JSON', async () => {
    const run = runReturning('not json');
    await expect(evaluatePolicy(scanResult, '/p/policy.rego', run)).rejects.toThrow(
      /could not parse opa output/
    );
  });
});
