const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
};
const LEVEL_COLOR = {
    critical: C.red,
    high: C.yellow,
    medium: C.blue,
    low: C.cyan,
    none: C.green,
};
const LEVEL_ICON = {
    critical: '✖',
    high: '▲',
    medium: '●',
    low: '◆',
    none: '✔',
};
function col(text, level) {
    return `${LEVEL_COLOR[level]}${text}${C.reset}`;
}
function pad(s, n) {
    return s.length >= n ? s.slice(0, n - 1) + '…' : s.padEnd(n);
}
export function renderTable(result) {
    const lines = [];
    lines.push('');
    lines.push(`${C.bold}ossrisk${C.reset}  ${C.dim}${result.manifest}${C.reset}`);
    lines.push(`${C.dim}${result.scannedAt}${C.reset}`);
    lines.push('');
    const nameW = Math.min(42, Math.max(20, ...result.results.map(r => r.name.length + 2)));
    lines.push(`  ${C.bold}${'Package'.padEnd(nameW)}${'Version'.padEnd(14)}${'Risk'.padEnd(11)}Details${C.reset}`);
    lines.push('  ' + '─'.repeat(84));
    for (const dep of result.results) {
        const details = dep.signals.map(s => {
            if (s.type === 'cve')
                return `${s.id} (${s.severity})`;
            if (s.type === 'eol')
                return `EOL ${s.eolDate}`;
            if (s.type === 'abandoned')
                return `no release in ${s.monthsSince}mo`;
            if (s.type === 'stale')
                return `last release ${s.monthsSince}mo ago`;
            if (s.type === 'outdated')
                return `latest ${s.latestVersion}`;
            if (s.type === 'typosquat')
                return `possible typosquat of ${s.suspectedTarget}`;
            if (s.type === 'license') {
                if (s.category === 'unknown')
                    return 'license unknown';
                return `${s.license} (${s.category})`;
            }
            if (s.type === 'maintainer') {
                return s.pattern === 'new-publisher' ? 'new publisher' : 'sole maintainer';
            }
        }).join('  ');
        const isClean = dep.riskLevel === 'none';
        const icon = LEVEL_ICON[dep.riskLevel];
        const name = pad(dep.name, nameW - 2);
        const viaSuffix = !dep.isDirect && dep.via ? `  via ${dep.via}` : '';
        lines.push(isClean
            ? `  ${C.dim}${icon} ${name}  ${dep.version.padEnd(12)}  ${'—'.padEnd(9)}  —${C.reset}`
            : `  ${col(`${icon} ${name}`, dep.riskLevel)}  ` +
                `${dep.version.padEnd(12)}  ` +
                `${col(dep.riskLevel.padEnd(9), dep.riskLevel)}  ` +
                `${C.dim}${details}${viaSuffix}${C.reset}`);
    }
    const s = result.summary;
    const parts = [
        `${C.bold}${s.total}${C.reset} deps`,
        s.critical ? col(`${s.critical} critical`, 'critical') : '',
        s.high ? col(`${s.high} high`, 'high') : '',
        s.medium ? col(`${s.medium} medium`, 'medium') : '',
        s.low ? col(`${s.low} low`, 'low') : '',
        col(`${s.clean} clean`, 'none'),
    ].filter(Boolean);
    lines.push('');
    lines.push(`  ${parts.join('  ·  ')}`);
    lines.push('');
    return lines.join('\n');
}
//# sourceMappingURL=table.js.map