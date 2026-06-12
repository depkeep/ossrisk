import { spawn } from 'child_process';
import { basename, dirname } from 'path';
import type { ScanResult } from './types.js';

// ossrisk delegates policy decisions to OPA (https://www.openpolicyagent.org).
// The scan result JSON is passed as `input`; policies live in `package ossrisk`
// and define a `deny` set of human-readable violation messages. Any message in
// `data.ossrisk.deny` fails the scan.

export interface OpaRunResult {
  // Exit code of the opa process, or null if it could not be spawned.
  code: number | null;
  stdout: string;
  stderr: string;
  // True when the `opa` binary was not found on PATH.
  notFound?: boolean;
}

export type RunOpa = (args: string[], stdin: string, cwd: string) => Promise<OpaRunResult>;

const runOpaProcess: RunOpa = (args, stdin, cwd) =>
  new Promise(resolvePromise => {
    const child = spawn('opa', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('error', (err: NodeJS.ErrnoException) =>
      resolvePromise({ code: null, stdout, stderr, notFound: err.code === 'ENOENT' })
    );
    child.on('close', code => resolvePromise({ code, stdout, stderr }));
    child.stdin.on('error', () => { /* spawn failure already handled above */ });
    child.stdin.write(stdin);
    child.stdin.end();
  });

interface OpaEvalOutput {
  result?: Array<{ expressions?: Array<{ value?: unknown }> }>;
}

export async function evaluatePolicy(
  result: ScanResult,
  policyPath: string,
  run: RunOpa = runOpaProcess
): Promise<string[]> {
  // opa parses `--data <prefix>:<path>`, which mangles absolute Windows paths
  // (`C:\policies` becomes prefix `C` + path `\policies`). Running opa from the
  // policy's parent directory and passing only the basename keeps drive
  // letters out of opa's path parser entirely.
  const cwd = dirname(policyPath);
  const data = basename(policyPath) || '.';

  const args = [
    'eval',
    '--format', 'json',
    '--stdin-input',
    '--data', data,
    'data.ossrisk.deny',
  ];

  const res = await run(args, JSON.stringify(result), cwd);

  if (res.notFound) {
    throw new Error(
      '--policy requires the OPA CLI (`opa`) on your PATH. ' +
      'Install it from https://www.openpolicyagent.org/docs/#running-opa, ' +
      'or pipe `ossrisk --format json` into conftest instead.'
    );
  }
  if (res.code !== 0) {
    const detail = res.stderr.trim() || res.stdout.trim() || `opa exited with code ${res.code}`;
    throw new Error(`policy evaluation failed: ${detail}`);
  }

  let parsed: OpaEvalOutput;
  try {
    parsed = JSON.parse(res.stdout) as OpaEvalOutput;
  } catch {
    throw new Error('policy evaluation failed: could not parse opa output');
  }

  const value = parsed.result?.[0]?.expressions?.[0]?.value;

  // An empty `result` means data.ossrisk.deny is undefined — the policy file
  // doesn't declare `package ossrisk` with a `deny` rule. Failing loudly here
  // beats silently passing a mis-named policy.
  if (value === undefined) {
    throw new Error(
      `policy at ${policyPath} does not define data.ossrisk.deny ` +
      '(expected `package ossrisk` with a `deny contains msg` rule)'
    );
  }
  if (!Array.isArray(value)) {
    throw new Error('data.ossrisk.deny must be a set of violation messages');
  }

  return value.map(String);
}
