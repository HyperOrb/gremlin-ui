import type { Report } from '../core/types.js';
export function terminal(
  report: Report,
  output: string,
  color = process.stdout.isTTY && !process.env.NO_COLOR,
): string {
  const paint = (s: string, code: number) =>
    color ? `\u001b[${code}m${s}\u001b[0m` : s;
  const tested = report.score.passed + report.score.failed;
  const bar =
    report.score.value === null
      ? '░'.repeat(20)
      : '█'.repeat(Math.round(report.score.value / 5)) +
        '░'.repeat(20 - Math.round(report.score.value / 5));
  const lines = [
    '',
    paint('👹 GREMLIN SURVIVAL REPORT', 92),
    '',
    `Your app survived ${report.score.passed} / ${tested} evaluated attacks.`,
    paint(`${bar}  ${report.score.value ?? '—'}/100`, 92),
    '',
    ...['critical', 'high', 'medium', 'low']
      .filter((s) => report.findings.some((f) => f.severity === s))
      .map(
        (s) =>
          `${s === 'high' || s === 'critical' ? '💥' : '⚠ '} ${report.findings.filter((f) => f.severity === s).length} ${s}`,
      ),
    `✓  ${report.score.passed} survived · ${report.score.skipped} skipped · ${report.score.errors} errors`,
    '',
  ];
  const priority = ['critical', 'high', 'medium', 'low'];
  const findings = [...report.findings].sort(
    (a, b) => priority.indexOf(a.severity) - priority.indexOf(b.severity),
  );
  for (const f of findings.slice(0, 6))
    lines.push(
      paint(
        `[${f.severity.toUpperCase()}] ${f.title}`,
        ['critical', 'high'].includes(f.severity) ? 91 : 93,
      ),
      `   ${f.id} · ${f.url}`,
      `   ${f.description}`,
      `   👹 “${f.personalityLine}”`,
      `   Evidence: ${f.screenshot ? output + '/' + f.screenshot : 'reproduction steps in report'}`,
      '',
    );
  if (findings.length > 6)
    lines.push(
      `${findings.length - 6} more findings in the HTML / JSON report.`,
      '',
    );
  if (report.status === 'partial')
    lines.push(
      paint(
        '⚠ Incomplete coverage. Inspect scenario errors before trusting the score.',
        93,
      ),
    );
  for (const warning of report.warnings.slice(0, 3)) lines.push(`⚠ ${warning}`);
  lines.push(
    `Completed in ${(report.durationMs / 1000).toFixed(1)}s.`,
    `Report: ${output}/report.html`,
    `JSON:   ${output}/report.json`,
    `${report.skippedActions.length} distinct actions / requests skipped by the safety guard.`,
    'Score = evaluated attacks survived; not a scientific UX grade.',
    '',
  );
  return lines.join('\n');
}
