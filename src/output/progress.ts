import type { ProgressCallback, ScanProgressEvent } from '../types.js';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface ProgressRenderer {
  onProgress: ProgressCallback;
  // Erase the progress line so final output starts on a clean row.
  clear: () => void;
}

// Renders a single self-overwriting progress line:
//   ⠹ checking 42/180  lodash@4.17.21
// Writes to stderr so stdout stays clean for json/markdown piping.
// Returns null when stderr is not a TTY (CI logs, redirects) — callers
// should pass no callback to scan() in that case.
export function createProgressRenderer(
  stream: NodeJS.WriteStream = process.stderr
): ProgressRenderer | null {
  if (!stream.isTTY) return null;

  let frame = 0;
  let lastLen = 0;

  const draw = (text: string) => {
    const width = stream.columns ?? 80;
    const line = text.length >= width ? text.slice(0, width - 2) + '…' : text;
    const pad = lastLen > line.length ? ' '.repeat(lastLen - line.length) : '';
    stream.write('\r' + line + pad);
    lastLen = line.length;
  };

  const clear = () => {
    if (lastLen > 0) {
      stream.write('\r' + ' '.repeat(lastLen) + '\r');
      lastLen = 0;
    }
  };

  const onProgress = (e: ScanProgressEvent) => {
    if (e.phase === 'done') {
      clear();
      return;
    }
    const spinner = FRAMES[frame++ % FRAMES.length];
    if (e.phase === 'cve') {
      draw(`${spinner} querying OSV for ${e.total} package${e.total === 1 ? '' : 's'}…`);
    } else {
      draw(`${spinner} checking ${e.completed}/${e.total}  ${e.current ?? ''}`);
    }
  };

  return { onProgress, clear };
}
