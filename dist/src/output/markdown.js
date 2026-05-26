const EMOJI = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    none: '🟢',
};
export function renderMarkdown(result) {
    const { summary } = result;
    const lines = [];
    lines.push('## ossrisk — Dependency Health Report');
    lines.push('');
    lines.push(`Scanned \`${result.manifest}\` · ${result.scannedAt}`);
    lines.push('');
    lines.push(`**${summary.total} dependencies** — ` +
        `${EMOJI.critical} ${summary.critical} critical · ` +
        `${EMOJI.high} ${summary.high} high · ` +
        `${EMOJI.medium} ${summary.medium} medium · ` +
        `${EMOJI.low} ${summary.low} low · ` +
        `${EMOJI.none} ${summary.clean} clean`);
    lines.push('');
    const risky = result.results.filter(r => r.riskLevel !== 'none');
    if (risky.length === 0) {
        lines.push('✅ All dependencies are healthy.');
        return lines.join('\n');
    }
    lines.push('| Package | Version | Risk | Details |');
    lines.push('|---------|---------|------|---------|');
    for (const dep of risky) {
        const details = dep.signals.map(s => {
            if (s.type === 'cve') {
                return `[${s.id}](https://osv.dev/vulnerability/${s.id}) — ${s.summary}`;
            }
            if (s.type === 'eol')
                return `EOL since ${s.eolDate} (cycle ${s.cycle})`;
            if (s.type === 'abandoned')
                return `No release in ${s.monthsSince} months (last: ${s.lastReleaseDate})`;
            if (s.type === 'stale')
                return `Last release ${s.monthsSince} months ago (${s.lastReleaseDate})`;
            if (s.type === 'outdated')
                return `Newer version available: ${s.latestVersion}`;
            if (s.type === 'typosquat')
                return `Possible typosquat of \`${s.suspectedTarget}\` (${s.reason})`;
            if (s.type === 'license') {
                if (s.category === 'unknown')
                    return 'License could not be determined';
                return `License \`${s.license}\` (${s.category}) — review for commercial use`;
            }
        }).join('<br>');
        lines.push(`| \`${dep.name}\` | \`${dep.version}\` | ${EMOJI[dep.riskLevel]} ${dep.riskLevel} | ${details} |`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=markdown.js.map