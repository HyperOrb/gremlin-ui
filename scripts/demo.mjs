import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { startDemo } from '../demo/server.mjs';
const demo = await startDemo(0);
await mkdir('artifacts', { recursive: true });
async function execute(variant) {
  const output = [];
  const code = await new Promise((ok, fail) => {
    const child = spawn(
      process.execPath,
      [
        'dist/cli/index.js',
        `${demo.url}/${variant}`,
        '--max-pages',
        '2',
        '--output',
        `artifacts/${variant}`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    child.stdout.on('data', (b) => {
      process.stdout.write(b);
      output.push(b.toString());
    });
    child.stderr.on('data', (b) => {
      process.stderr.write(b);
      output.push(b.toString());
    });
    child.on('error', fail);
    child.on('exit', ok);
  });
  await writeFile(`artifacts/${variant}/terminal.txt`, output.join(''));
  if (code !== 0)
    throw new Error(`Demo ${variant} exited ${code}; inspect the report.`);
  return JSON.parse(await readFile(`artifacts/${variant}/report.json`, 'utf8'));
}
try {
  const before = await execute('broken'),
    after = await execute('fixed');
  const key = (s) =>
    [
      s.category,
      s.title,
      s.viewport.width,
      s.viewport.height,
      s.url.replace(/\/(broken|fixed)(?=\/|$)/, '/variant'),
    ].join('|');
  const matched = before.scenarios.filter(
    (s) =>
      ['passed', 'failed'].includes(s.status) &&
      after.scenarios.some(
        (t) => key(t) === key(s) && ['passed', 'failed'].includes(t.status),
      ),
  );
  const matchedAfter = after.scenarios.filter(
    (s) =>
      ['passed', 'failed'].includes(s.status) &&
      matched.some((t) => key(t) === key(s)),
  );
  const common = {
    evaluated: matched.length,
    beforePassed: matched.filter((s) => s.status === 'passed').length,
    afterPassed: matchedAfter.filter((s) => s.status === 'passed').length,
  };
  const comparison = {
    commonCoverage: common,
    generatedAt: new Date().toISOString(),
    before: {
      score: before.score,
      findings: before.findings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
      })),
    },
    after: {
      score: after.score,
      findings: after.findings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
      })),
    },
    backendWrites: demo.stats.writes,
    dangerousActions: demo.stats.dangerous,
  };
  await writeFile(
    'artifacts/comparison.json',
    JSON.stringify(comparison, null, 2) + '\n',
  );
  console.log(
    `\n👹 BEFORE ${before.score.value} → AFTER ${after.score.value}\nMatched coverage: ${common.beforePassed}/${common.evaluated} → ${common.afterPassed}/${common.evaluated} survived.\nBackend writes: ${demo.stats.writes}. Dangerous actions: ${demo.stats.dangerous}.\nReal reports: artifacts/broken/report.html and artifacts/fixed/report.html\n`,
  );
  if (demo.stats.writes || demo.stats.dangerous)
    throw new Error('Safety regression: demo backend received writes.');
} finally {
  await demo.close();
}
