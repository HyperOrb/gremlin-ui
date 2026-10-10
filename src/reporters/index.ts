import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Report } from '../core/types.js';
import { html } from './html.js';
export { terminal } from './terminal.js';
export async function writeReport(
  report: Report,
  output: string,
): Promise<void> {
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  const {
    findings: _findings,
    scenarios: _scenarios,
    skippedActions: _skipped,
    ...metadata
  } = report;
  await writeFile(
    join(output, 'metadata.json'),
    JSON.stringify(metadata, null, 2) + '\n',
  );
  await writeFile(join(output, 'report.html'), html(report));
}
