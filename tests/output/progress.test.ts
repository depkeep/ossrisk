import { describe, expect, it } from 'vitest';
import { createProgressRenderer } from '../../src/output/progress.js';

function fakeStream(isTTY: boolean, columns = 80) {
  const writes: string[] = [];
  return {
    stream: {
      isTTY,
      columns,
      write: (s: string) => { writes.push(s); return true; },
    } as unknown as NodeJS.WriteStream,
    writes,
  };
}

describe('createProgressRenderer', () => {
  it('returns null when the stream is not a TTY', () => {
    const { stream } = fakeStream(false);
    expect(createProgressRenderer(stream)).toBeNull();
  });

  it('renders the OSV query phase with package count', () => {
    const { stream, writes } = fakeStream(true);
    const renderer = createProgressRenderer(stream)!;
    renderer.onProgress({ phase: 'cve', completed: 0, total: 12 });
    expect(writes.join('')).toContain('querying OSV for 12 packages');
  });

  it('renders per-dep progress with counter and current package', () => {
    const { stream, writes } = fakeStream(true);
    const renderer = createProgressRenderer(stream)!;
    renderer.onProgress({ phase: 'checks', completed: 3, total: 10, current: 'lodash@4.17.21' });
    const out = writes.join('');
    expect(out).toContain('checking 3/10');
    expect(out).toContain('lodash@4.17.21');
  });

  it('overwrites the line in place and pads out shorter lines', () => {
    const { stream, writes } = fakeStream(true);
    const renderer = createProgressRenderer(stream)!;
    renderer.onProgress({ phase: 'checks', completed: 1, total: 10, current: 'a-very-long-package-name@1.0.0' });
    renderer.onProgress({ phase: 'checks', completed: 2, total: 10, current: 'x@1' });
    const last = writes[writes.length - 1];
    expect(last.startsWith('\r')).toBe(true);
    // shorter line must be padded so leftovers from the longer one are erased
    expect(last.length).toBeGreaterThanOrEqual(writes[0].length);
  });

  it('truncates lines wider than the terminal', () => {
    const { stream, writes } = fakeStream(true, 20);
    const renderer = createProgressRenderer(stream)!;
    renderer.onProgress({ phase: 'checks', completed: 1, total: 10, current: 'some-extremely-long-package-name@10.20.30' });
    const line = writes[0].replace(/^\r/, '');
    expect(line.length).toBeLessThanOrEqual(20);
    expect(line.endsWith('…')).toBe(true);
  });

  it('clears the line on done', () => {
    const { stream, writes } = fakeStream(true);
    const renderer = createProgressRenderer(stream)!;
    renderer.onProgress({ phase: 'checks', completed: 1, total: 2, current: 'x@1' });
    renderer.onProgress({ phase: 'done', completed: 2, total: 2 });
    const last = writes[writes.length - 1];
    expect(last.trim()).toBe('');
    expect(last.startsWith('\r')).toBe(true);
    expect(last.endsWith('\r')).toBe(true);
  });
});
