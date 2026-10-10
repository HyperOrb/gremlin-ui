import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../dist/index.js';
import { startDemo } from '../demo/server.mjs';

test('custom family API runs in a guarded context with authorized storageState', async () => {
  const demo = await startDemo(0);
  const output = await mkdtemp(join(tmpdir(), 'gremlin-extension-'));
  let sawCookie = false;
  try {
    const state = join(output, 'state.json');
    await writeFile(
      state,
      JSON.stringify({
        cookies: [
          {
            name: 'fixture-session',
            value: 'authorized-fixture',
            domain: '127.0.0.1',
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      }),
    );
    const custom = {
      id: 'example',
      name: 'Example Gremlin',
      description: 'Verifies the documented extension contract',
      async run(ctx) {
        await ctx.test(
          'example:contract',
          'Extension contract',
          ctx.routes[0],
          async (a) => {
            sawCookie = (await a.page.evaluate(() => document.cookie)).includes(
              'fixture-session=authorized-fixture',
            );
            assert.ok(a.allowed('Show details'));
            assert.equal(a.allowed('Delete account'), false);
            await a.page.evaluate(() =>
              fetch('/fixed/api/preview', { method: 'POST', body: 'fixture' }),
            );
            assert.equal(a.observation.mutations.length, 1);
            await a.find({
              category: 'example',
              rule: 'fixture-proof',
              severity: 'low',
              confidence: 'high',
              title: 'Extension evidence',
              description: 'Contract verification in a real browser.',
              whyItMatters:
                'The custom extension receives the documented guarded page.',
              reproduction: ['Open the local fixture.'],
              personalityLine: 'A new Gremlin has entered the room.',
            });
          },
        );
      },
    };
    const report = await run(demo.url + '/redirect-test?to=%2Ffixed', {
      output,
      config: { maxPages: 1, storageState: state },
      customGremlins: [custom],
      installBrowser: false,
    });
    assert.equal(report.status, 'complete', JSON.stringify(report.scenarios));
    assert.equal(report.scenarios[0].url, demo.url + '/fixed');
    assert.equal(sawCookie, true);
    assert.equal(report.findings[0].category, 'example');
    assert.equal(report.score.value, 0);
    assert.equal(demo.stats.writes, 0);
  } finally {
    await demo.close();
    await rm(output, { recursive: true, force: true });
  }
});
