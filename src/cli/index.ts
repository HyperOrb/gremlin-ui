#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { run } from '../core/runner.js';
import { loadConfig, defaults, validateConfig } from '../core/config.js';
import { type Family, type Severity } from '../core/types.js';
import { gremlins } from '../gremlins/index.js';
import { isLocal, targetURL } from '../safety/index.js';
import { terminal, writeReport } from '../reporters/index.js';

const help = `👹 GREMLIN — Find the UX bugs you didn't know to test for.

Usage
  gremlin <URL>                      Explore a local app
  gremlin run <URL>                  Same thing, extra verb
  gremlin list                       Meet the five Gremlins
  gremlin init                       Create optional JSON configuration

Options
  --gremlin mobile,forms             Choose scenario families
  --mobile                          Mobile layout only
  --headed                          Watch Chromium work
  --output <directory>              Default: gremlin-report
  --config <file>                    Default: gremlin.config.json (optional)
  --staging                         Explicitly permit a remote staging target
  --max-pages <1–20>                 Default: 3, entry-page link discovery
  --timeout <milliseconds>           Navigation timeout (default: 10000)
  --storage-state <file>             Existing Playwright session; no login bypass
  --no-install                      Explain missing Chromium instead of downloading
  --no-screenshots                   Disable screenshot evidence
  --fail-on <severity>               Exit 1 on findings at or above this severity
  --debug                           Show diagnostic stack traces
  --help / --version

Every run writes HTML + JSON + metadata. Mutating HTTP requests and external
traffic are blocked. Use disposable local or staging data. This tool cannot
prove arbitrary application code harmless.

Exit codes: 0 completed; 1 requested finding threshold; 2 usage/run/coverage error.
`;
async function main(): Promise<void> {
  const { values: v, positionals: pos } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      headed: { type: 'boolean' },
      mobile: { type: 'boolean' },
      staging: { type: 'boolean' },
      debug: { type: 'boolean' },
      gremlin: { type: 'string' },
      output: { type: 'string' },
      config: { type: 'string' },
      'max-pages': { type: 'string' },
      timeout: { type: 'string' },
      'storage-state': { type: 'string' },
      'no-install': { type: 'boolean' },
      'no-screenshots': { type: 'boolean' },
      'fail-on': { type: 'string' },
    },
  });
  if (v.version) {
    console.log('gremlin-ui 0.1.0');
    return;
  }
  if (v.help || !pos.length) {
    console.log(help);
    return;
  }
  if (pos[0] === 'list') {
    if (pos.length > 1) throw new Error('list does not take arguments.');
    console.log(
      gremlins.map((g) => `${g.id.padEnd(12)} ${g.description}`).join('\n'),
    );
    return;
  }
  if (pos[0] === 'init') {
    if (pos.length > 1) throw new Error('init does not take arguments.');
    await writeFile(
      'gremlin.config.json',
      JSON.stringify(defaults, null, 2) + '\n',
      { flag: 'wx' },
    );
    console.log('👹 Created gremlin.config.json. Defaults work without it.');
    return;
  }
  if (pos[0] === 'run') pos.shift();
  if (pos.length !== 1) throw new Error('Use: gremlin <URL>. See --help.');
  const target = targetURL(pos[0]);
  if (!isLocal(target) && !v.staging)
    throw new Error(
      'Remote target: use --staging only for a disposable preview/staging environment you control. Production interaction is not the default.',
    );
  if (!isLocal(target))
    console.error(
      '⚠ Remote target enabled. Gremlin cannot verify this is staging; use disposable data.',
    );
  if (v.mobile && v.gremlin)
    throw new Error('Choose --mobile or --gremlin, not both.');
  const config = await loadConfig(v.config);
  if (v.mobile) config.gremlins = ['mobile'];
  if (v.gremlin) config.gremlins = v.gremlin.split(',') as Family[];
  if (v['max-pages']) config.maxPages = Number(v['max-pages']);
  if (v.timeout) config.timeout = Number(v.timeout);
  if (v['storage-state']) config.storageState = v['storage-state'];
  if (v['no-screenshots']) config.screenshots = false;
  validateConfig(config);
  const order: Severity[] = ['critical', 'high', 'medium', 'low'];
  if (v['fail-on'] && !order.includes(v['fail-on'] as Severity))
    throw new Error('--fail-on must be critical, high, medium, or low.');
  const output = resolve(v.output || 'gremlin-report');
  console.log(
    `\n👹 Gremlin entered your app.\n   ${target}\n   ${config.gremlins.length} Gremlins · local reports · guarded network\n`,
  );
  const report = await run(target, {
    config,
    output,
    headed: v.headed,
    debug: v.debug,
    installBrowser: !v['no-install'],
    onProgress(name, status, r) {
      if (status === 'running')
        process.stdout.write(`Testing ${name.toLowerCase()}… `);
      else {
        const id = gremlins.find((g) => g.name === name)!.id;
        const ss = r.scenarios.filter((s) => s.category === id);
        console.log(
          ss.some((s) => s.status === 'error')
            ? '⚠ incomplete'
            : ss.some((s) => s.status === 'failed')
              ? '💥 findings'
              : ss.every((s) => s.status === 'skipped')
                ? '↷ skipped'
                : '✓',
        );
      }
    },
  });
  if (!isLocal(target))
    report.warnings.push(
      'Remote target explicitly enabled with --staging; environment classification not verified.',
    );
  await writeReport(report, output);
  console.log(terminal(report, output));
  if (report.status === 'partial') process.exitCode = 2;
  else if (
    v['fail-on'] &&
    report.findings.some(
      (f) =>
        order.indexOf(f.severity) <= order.indexOf(v['fail-on'] as Severity),
    )
  )
    process.exitCode = 1;
}
main().catch((e) => {
  console.error(
    `\n👹 ${e.code === 'EEXIST' ? 'gremlin.config.json already exists; it was not overwritten.' : e.message}`,
  );
  if (process.argv.includes('--debug')) console.error(e.stack);
  process.exitCode = 2;
});
