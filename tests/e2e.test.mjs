import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { run, writeReport } from '../dist/index.js';
import { startDemo } from '../demo/server.mjs';
import { guard } from '../dist/safety/index.js';
import { defaults } from '../dist/core/config.js';

// Real Chromium + a real HTTP app. No mocked detector results.
test(
  'five families find seeded UX bugs, fixed version improves, and backend writes stay zero',
  { timeout: 180000 },
  async () => {
    const demo = await startDemo(0);
    const output = await mkdtemp(join(tmpdir(), 'gremlin-e2e-'));
    try {
      const config = { maxPages: 2 };
      const broken = await run(demo.url + '/broken', {
        config,
        output: join(output, 'broken'),
        installBrowser: false,
      });
      const fixed = await run(demo.url + '/fixed', {
        config,
        output: join(output, 'fixed'),
        installBrowser: false,
      });
      await writeReport(broken, join(output, 'broken'));
      await writeReport(fixed, join(output, 'fixed'));
      assert.equal(
        broken.status,
        'complete',
        JSON.stringify(broken.scenarios.filter((s) => s.status === 'error')),
      );
      assert.equal(
        fixed.status,
        'complete',
        JSON.stringify(fixed.scenarios.filter((s) => s.status === 'error')),
      );
      for (const family of defaults.gremlins)
        assert.ok(
          broken.scenarios.some((s) => s.category === family),
          family,
        );
      for (const rule of [
        'horizontal-overflow',
        'empty-submission',
        'invalid-submission',
        'whitespace-submission',
        'long-value-overflow',
        'broken-link',
        'inert-control',
        'no-visible-focus',
        'pointer-only-control',
        'duplicate-request-intent',
      ])
        assert.ok(
          broken.findings.some((f) => f.rule === rule),
          rule,
        );
      assert.equal(
        fixed.findings.length,
        0,
        JSON.stringify(
          fixed.findings.map((f) => ({ rule: f.rule, title: f.title })),
        ),
      );
      assert.ok(fixed.score.value > broken.score.value);
      const repeat = await run(demo.url + '/broken', {
        config: {
          gremlins: ['mobile'],
          viewports: [{ width: 320, height: 740 }],
          maxPages: 1,
          screenshots: false,
        },
        output: join(output, 'repeat'),
        installBrowser: false,
      });
      for (const f of repeat.findings)
        assert.ok(
          broken.findings.some((b) => b.id === f.id),
          'Stable finding IDs on matching route/rule/selector',
        );
      assert.equal(demo.stats.writes, 0);
      assert.equal(demo.stats.dangerous, 0);
      assert.ok(
        broken.skippedActions.some((s) => s.action.includes('Delete account')),
      );
      assert.ok(
        broken.skippedActions.some((s) => s.action.includes('Purchase')),
      );
      const screenshots = await readdir(join(output, 'broken', 'screenshots'));
      assert.equal(screenshots.length, broken.findings.length);
      for (const f of broken.findings) {
        assert.ok(f.reproduction.length);
        assert.ok(f.whyItMatters);
        assert.ok(f.screenshot);
        const bytes = await readFile(join(output, 'broken', f.screenshot));
        assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
        assert.equal(
          bytes.readUInt32BE(16),
          f.viewport.width,
          'Screenshot width matches observed viewport',
        );
        assert.equal(
          bytes.readUInt32BE(20),
          f.viewport.height,
          'Screenshot height matches observed viewport',
        );
      }
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto('file://' + join(output, 'broken', 'report.html'));
        assert.equal(
          await page.locator('.finding').count(),
          broken.findings.length,
        );
        await page.locator('#severity').selectOption('high');
        assert.equal(
          await page.locator('.finding:visible').count(),
          broken.findings.filter((f) => f.severity === 'high').length,
        );
        await page.locator('#search').fill('nothing matches this');
        assert.equal(await page.locator('.finding:visible').count(), 0);
        assert.equal(await page.locator('#empty').isVisible(), true);
        await page.locator('#reset').click();
        assert.equal(
          await page.locator('.finding:visible').count(),
          broken.findings.length,
        );
        for (const width of [320, 390, 1280]) {
          await page.setViewportSize({ width, height: 800 });
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 2,
            ),
            true,
            `Report overflow at ${width}`,
          );
        }
      } finally {
        await browser.close();
      }
    } finally {
      await demo.close();
      await rm(output, { recursive: true, force: true });
    }
  },
);

test(
  'network guard blocks HTTP writes, external GETs, redirects, popups, and sockets',
  { timeout: 30000 },
  async () => {
    const demo = await startDemo(0);
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const observation = { mutations: [], errors: [] };
      const skips = [];
      await guard(context, demo.url, defaults, observation, (s) =>
        skips.push(s),
      );
      const page = await context.newPage();
      await page.goto(demo.url + '/fixed');
      const result = await page.evaluate(async () => {
        const r = await fetch('/fixed/api/preview', {
          method: 'POST',
          body: 'test',
        });
        const body = await r.json();
        await fetch('https://external.invalid/api', {
          method: 'POST',
          body: 'test',
        }).catch(() => {});
        await fetch('/fixed/api/delete', { method: 'GET' });
        new WebSocket('ws://127.0.0.1:' + location.port + '/ws');
        return {
          status: r.status,
          body,
          beacon: navigator.sendBeacon('/fixed/api/preview', 'test'),
        };
      });
      assert.equal(result.status, 409);
      assert.equal(result.body.gremlinBlocked, true);
      assert.equal(result.beacon, false);
      await page.waitForTimeout(200);
      assert.equal(demo.stats.writes, 0);
      assert.equal(observation.mutations.length, 1);
      assert.ok(skips.some((s) => s.reason.includes('External')));
      assert.ok(skips.some((s) => s.action === 'WebSocket'));
      assert.ok(skips.some((s) => s.reason.includes('destructive')));
      let externalHits = 0;
      const external = http.createServer((req, res) => {
        externalHits++;
        res.end('External endpoint should never be reached.');
      });
      await new Promise((ok) => external.listen(0, '127.0.0.1', ok));
      try {
        const externalURL = `http://127.0.0.1:${external.address().port}/write-by-get`;
        await page.goto(
          demo.url + '/redirect-test?to=' + encodeURIComponent(externalURL),
        );
        assert.equal(
          externalHits,
          0,
          'Redirected external GET must never reach its server',
        );
      } finally {
        await new Promise((ok) => external.close(ok));
      }
      await page.goto(
        demo.url + '/redirect-test?to=' + encodeURIComponent('/fixed'),
      );
      await page.waitForURL(demo.url + '/fixed');
      assert.ok((await page.title()).includes('Fixed'));
      const popupPromise = context.waitForEvent('page');
      await page.evaluate(() => window.open('https://external.invalid/'));
      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      assert.ok(skips.some((s) => s.url === 'https://external.invalid/'));
      await context.close();
    } finally {
      await browser.close();
      await demo.close();
    }
  },
);
