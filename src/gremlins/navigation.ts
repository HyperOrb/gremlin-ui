import { controls, fingerprint } from '../discovery/index.js';
import type { Gremlin } from '../core/types.js';

export const navigation: Gremlin = {
  id: 'navigation',
  name: 'Navigation',
  description:
    'Follow internal links, Back/Forward/reload, and check inert pointer controls.',
  async run(ctx) {
    for (const url of ctx.routes) {
      await ctx.test(
        'navigation:runtime',
        'Console and runtime errors on direct load',
        url,
        async (a) => {
          if (a.observation.errors.length && !a.observation.mutations.length)
            await a.find({
              category: 'navigation',
              rule: 'load-runtime-error',
              severity: 'medium',
              confidence: 'high',
              title: 'Direct page load reports a console or runtime error',
              description: a.observation.errors.join('; '),
              whyItMatters:
                'Unhandled exceptions and explicit console errors can reveal broken deep-link initialization.',
              reproduction: [
                `Open ${url} directly in a fresh browser tab`,
                'Inspect the developer console.',
              ],
              personalityLine:
                'I opened a tab. JavaScript already had complaints.',
              metadata: { errors: a.observation.errors },
            });
        },
      );
      await ctx.test(
        'navigation:links',
        'Internal link destinations',
        url,
        async (a) => {
          const links = (await controls(a.page)).filter(
            (c) => c.href && c.href !== url && !c.href.includes('#'),
          );
          let tested = 0;
          for (const c of links.slice(0, 8)) {
            if (!a.allowed(c.label, c.href)) continue;
            tested++;
            const response = await a.page.goto(c.href!, {
              waitUntil: 'domcontentloaded',
            });
            if (response && response.status() >= 400)
              await a.find({
                category: 'navigation',
                rule: 'broken-link',
                severity: 'high',
                confidence: 'high',
                title: 'Internal link opens an error page',
                description: `“${c.label}” points to ${c.href}, which returned HTTP ${response.status()}.`,
                whyItMatters:
                  'A visible navigation action ends the user journey at a dead end.',
                selector: c.selector,
                reproduction: [
                  `Open ${url}`,
                  `Follow “${c.label}” (${c.href})`,
                  `Observe HTTP ${response.status()}.`,
                ],
                personalityLine:
                  'I followed your link. The destination did not.',
                metadata: { destination: c.href, status: response.status() },
              });
          }
          if (!tested)
            a.skip('Internal links', 'No safe internal link destinations.');
        },
      );
      await ctx.test(
        'navigation:history',
        'Back, Forward, and reload',
        url,
        async (a) => {
          const link = (await controls(a.page)).find(
            (c) =>
              c.href &&
              c.href !== url &&
              !c.href.includes('#') &&
              a.allowed(c.label, c.href),
          );
          if (!link)
            a.skip(
              'Browser history',
              'No safe internal link for history traversal.',
            );
          const errorsBefore = a.observation.errors.length;
          await a.page.locator(link!.selector).click();
          await a.settle();
          const destination = a.page.url();
          await a.page.goBack({ waitUntil: 'domcontentloaded' });
          await a.settle();
          const returned = a.page.url();
          await a.page.goForward({ waitUntil: 'domcontentloaded' });
          await a.settle();
          const forwarded = a.page.url();
          await a.page.reload({ waitUntil: 'domcontentloaded' });
          await a.settle();
          if (returned !== url || forwarded !== destination)
            await a.find({
              category: 'navigation',
              rule: 'history-mismatch',
              severity: 'medium',
              confidence: 'medium',
              title: 'History does not return to the observed route',
              description: `Back returned to ${returned}; Forward returned to ${forwarded}; expected observed routes ${url} and ${destination}. Redirects may be intentional.`,
              whyItMatters:
                'Unexpected history changes can break users returning to unfinished work.',
              selector: link!.selector,
              reproduction: [
                `Open ${url}`,
                `Follow “${link!.label}”`,
                'Press Back, then Forward, then reload.',
              ],
              personalityLine:
                'I pressed Back. Your browser took creative liberties.',
              metadata: { destination, returned, forwarded },
            });
          const errors = a.observation.errors.slice(errorsBefore);
          if (errors.length && !a.observation.mutations.length)
            await a.find({
              category: 'navigation',
              rule: 'history-runtime-error',
              severity: 'high',
              confidence: 'high',
              title: 'Browser history triggers a runtime error',
              description: errors.join('; '),
              whyItMatters:
                'Navigation should remain functional when users revisit or reload a route.',
              reproduction: [
                `Open ${url}`,
                `Follow “${link!.label}”`,
                'Press Back, Forward, and reload. Inspect the console.',
              ],
              personalityLine: 'Your history has baggage.',
              metadata: { errors },
            });
        },
      );
      await ctx.test(
        'navigation:dead-controls',
        'Pointer controls that appear inert',
        url,
        async (a) => {
          const cs = (await controls(a.page)).filter(
            (c) => !c.href && c.tag !== 'input' && c.type !== 'submit',
          );
          let tested = 0;
          for (const c of cs.slice(0, 6)) {
            if (!a.allowed(c.label)) continue;
            const form = await a.page
              .locator(c.selector)
              .evaluate((el) => !!el.closest('form'));
            if (form) continue;
            const pointer = await a.page
              .locator(c.selector)
              .evaluate((el) => getComputedStyle(el).cursor === 'pointer');
            if (!pointer || !(await a.page.locator(c.selector).isEnabled()))
              continue;
            tested++;
            const before = await fingerprint(a.page);
            const reqs = a.observation.mutations.length;
            await a.page.locator(c.selector).click({ timeout: 1500 });
            await a.page.waitForTimeout(Math.max(ctx.config.settleMs, 500));
            const after = await fingerprint(a.page);
            if (before === after && reqs === a.observation.mutations.length)
              await a.find({
                category: 'navigation',
                rule: 'inert-control',
                severity: 'low',
                confidence: 'medium',
                title: 'Clickable control produces no observed response',
                description: `“${c.label}” has a pointer cursor but produced no observed text, URL, input-state, dialog, or write-request change within ${Math.max(ctx.config.settleMs, 500)}ms. Non-text visual effects or slower feedback may be intentional.`,
                whyItMatters:
                  'An action without visible feedback invites retries and confusion. Confirm manually before changing it.',
                selector: c.selector,
                reproduction: [
                  `Open ${url}`,
                  `Click “${c.label}”`,
                  'Look for visible feedback or navigation.',
                ],
                personalityLine:
                  'I clicked something that looked clickable. I am still waiting.',
                metadata: {
                  label: c.label,
                  observationWindowMs: Math.max(ctx.config.settleMs, 500),
                },
              });
            if (a.page.url() !== url) break;
          }
          if (!tested)
            a.skip('Pointer controls', 'No safe pointer control found.');
        },
      );
    }
  },
};
