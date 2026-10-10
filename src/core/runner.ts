import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { defaults, validateConfig } from './config.js';
import {
  actionReason,
  guard,
  routeReason,
  targetURL,
} from '../safety/index.js';
import { controls } from '../discovery/index.js';
import { score } from './score.js';
import { gremlins } from '../gremlins/index.js';
import type {
  Config,
  FindingInput,
  Gremlin,
  GremlinContext,
  Observation,
  Report,
  Scenario,
  SkippedAction,
  Viewport,
  Family,
} from './types.js';

export class Skip extends Error {}
export interface RunOptions {
  config?: Partial<Config>;
  output?: string;
  headed?: boolean;
  installBrowser?: boolean;
  debug?: boolean;
  customGremlins?: Gremlin[];
  onProgress?: (
    name: string,
    status: 'running' | 'done',
    report: Report,
  ) => void;
}
export async function launch(
  headed = false,
  install = true,
  debug = false,
): Promise<Browser> {
  try {
    return await chromium.launch({ headless: !headed });
  } catch (e) {
    if (!String(e).includes("Executable doesn't exist")) throw e;
    if (!install)
      throw new Error(
        'Chromium is missing. Run: npx playwright install chromium',
      );
    process.stderr.write(
      '👹 First visit: installing Chromium. This one-time download may take a minute.\n',
    );
    const require = createRequire(import.meta.url);
    const cli = join(
      dirname(require.resolve('playwright/package.json')),
      'cli.js',
    );
    await new Promise<void>((ok, fail) => {
      const child = spawn(
        process.execPath,
        [
          cli,
          'install',
          'chromium',
          headed ? '--no-shell' : '--only-shell',
          '--no-progress',
          '--no-remove',
        ],
        {
          stdio: debug ? 'inherit' : ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_GC: '1' },
        },
      );
      let diagnostics = '';
      for (const stream of [child.stdout, child.stderr])
        stream?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          diagnostics = (diagnostics + chunk).slice(-16000);
          for (const line of chunk.split('\n'))
            if (/^Downloading|downloaded to/.test(line))
              process.stderr.write(line + '\n');
        });
      child.on('error', fail);
      child.on('exit', (code) =>
        code === 0
          ? ok()
          : fail(
              new Error(
                'Browser installation failed. ' +
                  (diagnostics.match(/^Error: (.+)$/m)?.[1] ??
                    'Check your connection and browser dependencies.') +
                  ' Run: npx playwright install --with-deps chromium',
              ),
            ),
      );
    });
    return chromium.launch({ headless: !headed });
  }
}
export async function run(
  raw: string,
  options: RunOptions = {},
): Promise<Report> {
  const target = targetURL(raw);
  const config = validateConfig(options.config ?? defaults);
  const output = resolve(options.output ?? 'gremlin-report');
  if (routeReason(target, target, config))
    throw new Error(`Target refused: ${routeReason(target, target, config)}`);
  await mkdir(join(output, 'screenshots'), { recursive: true });
  const start = Date.now();
  const report: Report = {
    schemaVersion: 1,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      browser: '',
    },
    tool: { name: 'gremlin-ui', version: '0.1.0' },
    target,
    startedAt: new Date().toISOString(),
    durationMs: 0,
    status: 'complete',
    config,
    safety: {
      networkWritesBlocked: true,
      externalRequestsBlocked: true,
      websocketsBlocked: true,
    },
    score: score([]),
    findings: [],
    scenarios: [],
    skippedActions: [],
    warnings: [],
  };
  const skipped = new Set<string>();
  const skip = (s: SkippedAction) => {
    const key = JSON.stringify(s);
    if (!skipped.has(key)) {
      skipped.add(key);
      report.skippedActions.push(s);
    }
  };
  const browser = await launch(
    options.headed,
    options.installBrowser,
    options.debug,
  );
  report.environment.browser = browser.version();
  async function session(viewport: Viewport): Promise<{
    context: BrowserContext;
    page: Page;
    observation: Observation;
  }> {
    const context = await browser.newContext({
      viewport,
      storageState: config.storageState,
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    context.setDefaultTimeout(Math.min(2500, config.timeout));
    context.setDefaultNavigationTimeout(config.timeout);
    const observation: Observation = { mutations: [], errors: [] };
    await guard(context, target, config, observation, skip);
    const page = await context.newPage();
    page.on('pageerror', (error) => observation.errors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !message.text().startsWith('Failed to load resource:')
      )
        observation.errors.push(message.text());
    });
    page.on('dialog', (dialog) => {
      skip({
        url: page.url(),
        action: dialog.type(),
        reason: 'Browser dialog dismissed conservatively.',
      });
      void dialog.dismiss();
    });
    return { context, page, observation };
  }
  async function open(page: Page, url: string): Promise<void> {
    const reason = routeReason(url, target, config);
    if (reason) throw new Skip(reason);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (new URL(page.url()).origin !== new URL(target).origin)
      throw new Error(
        'Application redirects externally; use a local authenticated route or storageState.',
      );
    if (response && response.status() >= 400)
      throw new Error(`HTTP ${response.status()} at ${url}`);
    await page.waitForTimeout(config.settleMs);
  }
  try {
    const routes: string[] = [target];
    const discovery = await session({ width: 1280, height: 800 });
    try {
      await open(discovery.page, target);
      routes[0] = discovery.page.url();
      if (await discovery.page.locator('input[type=password]').count())
        report.warnings.push(
          'Authentication controls detected. This run audits the visible page; provide authorized storageState to test signed-in routes.',
        );
      for (const c of await controls(discovery.page)) {
        const reason =
          actionReason(c.label, config) ??
          (c.href ? routeReason(c.href, target, config) : undefined);
        if (reason)
          skip({
            url: target,
            action: c.label || c.href || c.selector,
            reason,
          });
      }
      const links = (await controls(discovery.page))
        .filter((c) => c.href)
        .map((c) => c.href!);
      const includes = config.includeRoutes.map(
        (path) => new URL(path, target).href,
      );
      for (const rawLink of [...includes, ...links]) {
        const u = new URL(rawLink);
        u.hash = '';
        // Query routes require explicit inclusion: avoid unbounded or stateful crawler requests.
        if (u.search && !includes.includes(rawLink)) continue;
        const reason = routeReason(u.href, target, config);
        if (reason) {
          skip({ url: target, action: u.href, reason });
          continue;
        }
        if (!routes.includes(u.href) && routes.length < config.maxPages)
          routes.push(u.href);
      }
    } finally {
      await discovery.context.close();
    }
    const context: GremlinContext = {
      browser,
      config,
      target,
      routes,
      async test(id, title, url, fn, viewport = { width: 1280, height: 800 }) {
        const category = id.split(':')[0];
        const s: Scenario = {
          id: `${id}:${url}:${viewport.width}x${viewport.height}`,
          title,
          category,
          url,
          viewport,
          status: 'passed',
          findingIds: [],
          durationMs: 0,
        };
        const began = Date.now();
        let testContext: BrowserContext | undefined;
        try {
          const x = await session(viewport);
          testContext = x.context;
          await open(x.page, url);
          const allowed = (label: string, route?: string) => {
            const reason =
              actionReason(label, config) ??
              (route ? routeReason(route, target, config) : undefined);
            if (reason) {
              skip({
                url,
                action: label || route || 'Unlabelled action',
                reason,
              });
              return false;
            }
            return true;
          };
          const find = async (input: FindingInput) => {
            const key = [
              input.category,
              input.rule,
              url,
              input.selector ?? 'page',
            ].join('|');
            const id =
              'GR-' +
              createHash('sha256').update(key).digest('hex').slice(0, 10);
            s.findingIds.push(id);
            s.status = 'failed';
            if (!report.findings.some((f) => f.id === id)) {
              const finding = {
                ...input,
                id,
                url,
                viewport: x.page.viewportSize() ?? viewport,
                metadata: input.metadata ?? {},
              };
              if (config.screenshots) {
                try {
                  const screenshot = `screenshots/${id}.png`;
                  await x.page.screenshot({
                    path: join(output, screenshot),
                    fullPage: false,
                    timeout: config.timeout,
                  });
                  Object.assign(finding, { screenshot });
                } catch {
                  report.warnings.push(
                    `Screenshot unavailable for ${id}. Reproduction steps remain available.`,
                  );
                }
              }
              report.findings.push(finding);
            }
          };
          await fn({
            page: x.page,
            observation: x.observation,
            find,
            allowed,
            skip: (action, reason) => {
              skip({ url, action, reason });
              throw new Skip(reason);
            },
            settle: () => x.page.waitForTimeout(config.settleMs),
          });
        } catch (e) {
          if (e instanceof Skip && s.status !== 'failed') {
            s.status = 'skipped';
            s.reason = e.message;
          } else if (!(e instanceof Skip)) {
            s.status = 'error';
            s.reason = String(e).split('\n')[0].slice(0, 300);
            report.status = 'partial';
          }
        } finally {
          await testContext?.close();
          s.durationMs = Date.now() - began;
          report.scenarios.push(s);
        }
      },
    };
    for (const g of options.customGremlins ??
      gremlins.filter((g) => config.gremlins.includes(g.id as Family))) {
      options.onProgress?.(g.name, 'running', report);
      await g.run(context);
      report.score = score(report.scenarios);
      options.onProgress?.(g.name, 'done', report);
    }
  } catch (e) {
    throw new Error(
      `Could not explore ${target}: ${String(e).split('\n')[0]}. Check that the server is running and accessible.`,
      { cause: e },
    );
  } finally {
    await browser.close();
  }
  report.durationMs = Date.now() - start;
  report.score = score(report.scenarios);
  return report;
}
