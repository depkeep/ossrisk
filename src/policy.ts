import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { basename, delimiter, dirname, join } from 'path';
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

// Resolve `opa` to an absolute path instead of letting spawn() search for it.
// spawn('opa', { cwd }) searches the *child's* cwd on Windows, and
// evaluatePolicy overrides cwd to the policy directory — so a bare command
// name would resolve differently there than in the preflight check.
// Search order mirrors Windows convention: current directory (Windows only),
// then PATH.
export function resolveOpaPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): string | null {
  const isWin = process.platform === 'win32';
  const exts = isWin
    ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];
  const dirs = [
    ...(isWin ? [cwd] : []),
    ...(env.PATH ?? '').split(delimiter).filter(Boolean),
  ];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, 'opa' + ext.toLowerCase());
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const runOpaProcess: RunOpa = (args, stdin, cwd) =>
  new Promise(resolvePromise => {
    const opa = resolveOpaPath();
    if (!opa) {
      resolvePromise({ code: null, stdout: '', stderr: '', notFound: true });
      return;
    }
    const child = spawn(opa, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
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

const OPA_MISSING_MESSAGE =
  '--policy requires the OPA CLI (`opa`) on your PATH. ' +
  'Install it from https://www.openpolicyagent.org/docs/#running-opa, ' +
  'or pipe `ossrisk --format json` into conftest instead.';

// Preflight check so a missing opa binary fails before the scan starts,
// not after minutes of network calls.
export async function assertOpaAvailable(run: RunOpa = runOpaProcess): Promise<void> {
  const res = await run(['version'], '', '.');
  if (res.notFound) throw new Error(OPA_MISSING_MESSAGE);
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
    throw new Error(OPA_MISSING_MESSAGE);
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
