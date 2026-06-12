import type { ProgressCallback } from '../types.js';
export interface ProgressRenderer {
    onProgress: ProgressCallback;
    clear: () => void;
}
export declare function createProgressRenderer(stream?: NodeJS.WriteStream): ProgressRenderer | null;
//# sourceMappingURL=progress.d.ts.map