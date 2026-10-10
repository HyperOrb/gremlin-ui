import type { Report, Scenario } from './types.js';
export function score(scenarios: Scenario[]): Report['score'] {
  const counts = { passed: 0, failed: 0, skipped: 0, errors: 0 };
  for (const s of scenarios)
    s.status === 'error' ? counts.errors++ : counts[s.status]++;
  const tested = counts.passed + counts.failed;
  return {
    ...counts,
    value: tested ? Math.round((100 * counts.passed) / tested) : null,
    formula:
      'round(100 × passed / (passed + failed)); skips and errors excluded. A comparative run metric, not a UX grade.',
  };
}
