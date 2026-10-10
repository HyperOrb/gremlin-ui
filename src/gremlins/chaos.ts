import { controls, fingerprint, overflow } from '../discovery/index.js';
import type { Gremlin } from '../core/types.js';

export const chaos: Gremlin = {
  id: 'chaos',
  name: 'Impatient interaction',
  description:
    'Rapid native clicks, repeated write intents, and resize/reload during local interactions.',
  async run(ctx) {
    for (const url of ctx.routes) {
      await ctx.test(
        'chaos:repeat',
        'Repeated action attempts',
        url,
        async (a) => {
          const cs = (await controls(a.page)).filter(
            (c) => c.tag === 'button' && c.type !== 'submit',
          );
          let tested = 0;
          for (const c of cs.slice(0, 5)) {
            if (
              !a.allowed(c.label) ||
              (await a.page
                .locator(c.selector)
                .evaluate((el) => !!el.closest('form'))) ||
              !(await a.page.locator(c.selector).isEnabled())
            )
              continue;
            tested++;
            const baselineStart = a.observation.mutations.length;
            await a.page.locator(c.selector).click({ timeout: 1500 });
            await a.page.waitForTimeout(Math.max(650, ctx.config.settleMs));
            const single = a.observation.mutations.slice(baselineStart);
            if (a.page.url() !== url) break;
            await a.page.reload({ waitUntil: 'domcontentloaded' });
            await a.settle();
            const mutationStart = a.observation.mutations.length;
            const errorStart = a.observation.errors.length;
            // Real trusted pointer events, no force or synthetic dispatch.
            await a.page
              .locator(c.selector)
              .click({ clickCount: 2, delay: 45, timeout: 1500 });
            await a.page.waitForTimeout(Math.max(650, ctx.config.settleMs));
            const intents = a.observation.mutations.slice(mutationStart);
            const groups = new Map<string, number>();
            for (const r of intents) {
              const key = `${r.method} ${r.url} ${r.body ?? ''}`;
              groups.set(key, (groups.get(key) ?? 0) + 1);
            }
            const baseline = new Map<string, number>();
            for (const r of single) {
              const key = `${r.method} ${r.url} ${r.body ?? ''}`;
              baseline.set(key, (baseline.get(key) ?? 0) + 1);
            }
            const duplicate = [...groups.entries()].some(
              ([key, n]) => n > 1 && n > (baseline.get(key) ?? 0),
            );
            if (duplicate)
              await a.find({
                category: 'chaos',
                rule: 'duplicate-request-intent',
                severity: 'high',
                confidence: 'high',
                title: 'Double-click dispatches duplicate write attempts',
                description: `Two rapid clicks on “${c.label}” dispatched more identical mutation requests than the single-click baseline. Gremlin blocked all writes; backend duplication is not asserted.`,
                whyItMatters:
                  'Repeated submissions need pending-state or idempotency protection. A server may already deduplicate; verify before changing it.',
                selector: c.selector,
                reproduction: [
                  `Open ${url}`,
                  `Double-click “${c.label}” with ~45ms between clicks`,
                  'Inspect repeated identical requests in the Network panel using a disposable test backend.',
                ],
                personalityLine:
                  'You gave me no reason to wait. So I clicked twice.',
                metadata: {
                  singleClickAttempts: single.length,
                  attempts: intents.length,
                  requests: intents.map((r) => ({
                    method: r.method,
                    url: r.url,
                  })),
                  writesBlocked: true,
                },
              });
            const errors = a.observation.errors.slice(errorStart);
            if (errors.length && !intents.length)
              await a.find({
                category: 'chaos',
                rule: 'interaction-runtime-error',
                severity: 'high',
                confidence: 'high',
                title: 'Rapid interaction triggers a runtime error',
                description: errors.join('; '),
                whyItMatters:
                  'An impatient action should not throw an unhandled application error.',
                selector: c.selector,
                reproduction: [
                  `Open ${url}`,
                  `Double-click “${c.label}”`,
                  'Inspect the browser console.',
                ],
                personalityLine: 'Two clicks. One unhappy JavaScript engine.',
                metadata: { errors },
              });
            if (a.page.url() !== url) break;
          }
          if (!tested)
            a.skip('Rapid clicks', 'No safe button outside a form discovered.');
        },
      );
      await ctx.test(
        'chaos:resize-reload',
        'Resize during interaction and reload',
        url,
        async (a) => {
          const c = (await controls(a.page)).find(
            (c) =>
              c.tag === 'button' && c.type !== 'submit' && a.allowed(c.label),
          );
          if (
            !c ||
            (await a.page
              .locator(c.selector)
              .evaluate((el) => !!el.closest('form')))
          )
            a.skip('Resize during action', 'No safe non-form interaction.');
          const before = await fingerprint(a.page);
          await a.page.locator(c!.selector).click({ timeout: 1500 });
          await a.page.setViewportSize({ width: 320, height: 740 });
          await a.settle();
          const o = await overflow(a.page);
          if (o)
            await a.find({
              category: 'chaos',
              rule: 'interaction-resize-overflow',
              severity: 'medium',
              confidence: 'high',
              title: 'Layout overflows after interaction and resize',
              description: `The interface is ${o.width}px wide after activating “${c!.label}” and resizing to 320px.`,
              whyItMatters:
                'An interaction followed by a small viewport should keep the resulting interface usable.',
              selector: c!.selector,
              reproduction: [
                `Open ${url} at 1280×800`,
                `Click “${c!.label}”`,
                'Immediately resize to 320×740.',
              ],
              personalityLine:
                'I clicked, then rotated. The layout did not keep up.',
              metadata: {
                ...o,
                baselineChanged: before !== (await fingerprint(a.page)),
              },
            });
          await a.page.reload({ waitUntil: 'domcontentloaded' });
          await a.settle();
          if (!(await a.page.locator('body').innerText()))
            await a.find({
              category: 'chaos',
              rule: 'blank-after-reload',
              severity: 'high',
              confidence: 'high',
              title: 'Reload leaves the page blank',
              description:
                'No visible body text remains after an interaction, resize, and reload.',
              whyItMatters:
                'Users routinely reload pages during unfinished interactions.',
              reproduction: [
                `Open ${url}`,
                `Click “${c!.label}”`,
                'Resize to 320px and reload.',
              ],
              personalityLine:
                'I refreshed. Your app took the rest of the day off.',
            });
        },
      );
    }
  },
};
