import type { RiskLevel, ScanResult } from '../types.js';

const EMOJI: Record<RiskLevel, string> = {
  critical: '🔴',
  high:     '🟠',
  medium:   '🟡',
  low:      '🔵',
  none:     '🟢',
};

export function renderMarkdown(result: ScanResult): string {
  const { summary } = result;
  const lines: string[] = [];

  lines.push('## ossrisk — Dependency Health Report');
  lines.push('');
  lines.push(`Scanned \`${result.manifest}\` · ${result.scannedAt}`);
  lines.push('');
  lines.push(
    `**${summary.total} dependencies** — ` +
    `${EMOJI.critical} ${summary.critical} critical · ` +
    `${EMOJI.high} ${summary.high} high · ` +
    `${EMOJI.medium} ${summary.medium} medium · ` +
    `${EMOJI.low} ${summary.low} low · ` +
    `${EMOJI.none} ${summary.clean} clean`
  );
  lines.push('');

  const risky = result.results.filter(r => r.riskLevel !== 'none');

  if (risky.length === 0) {
    lines.push('✅ All dependencies are healthy.');
    return lines.join('\n');
  }

  lines.push('| Package | Version | Risk | Path | Details |');
  lines.push('|---------|---------|------|------|---------|');

  for (const dep of risky) {
    const details = dep.signals.map(s => {
      if (s.type === 'cve') {
        return `[${s.id}](https://osv.dev/vulnerability/${s.id}) — ${s.summary}`;
      }
      if (s.type === 'eol')       return `EOL since ${s.eolDate} (cycle ${s.cycle})`;
      if (s.type === 'abandoned') return `No release in ${s.monthsSince} months (last: ${s.lastReleaseDate})`;
      if (s.type === 'stale')     return `Last release ${s.monthsSince} months ago (${s.lastReleaseDate})`;
      if (s.type === 'outdated')  return `Newer version available: ${s.latestVersion}`;
      if (s.type === 'typosquat') return `Possible typosquat of \`${s.suspectedTarget}\` (${s.reason})`;
      if (s.type === 'license') {
        if (s.category === 'unknown') return 'License could not be determined';
        return `License \`${s.license}\` (${s.category}) — review for commercial use`;
      }
      if (s.type === 'maintainer') {
        const heading = s.pattern === 'new-publisher' ? 'New publisher' : 'Sole maintainer';
        return `${heading}: ${s.detail}`;
      }
    }).join('<br>');

    const path = dep.isDirect
      ? 'direct'
      : dep.via ? `via \`${dep.via}\`` : 'transitive';

    lines.push(
      `| \`${dep.name}\` | \`${dep.version}\` | ${EMOJI[dep.riskLevel]} ${dep.riskLevel} | ${path} | ${details} |`
    );
  }

  return lines.join('\n');
}
