import { controls, overflow } from '../discovery/index.js';
import type { Gremlin } from '../core/types.js';

export const mobile: Gremlin = {
  id: 'mobile',
  name: 'Mobile layout',
  description:
    'Shrink to 320, 375, 390px and desktop; inspect overflow and blocked controls.',
  async run(ctx) {
    for (const url of ctx.routes)
      for (const viewport of ctx.config.viewports) {
        await ctx.test(
          'mobile:layout',
          `Layout at ${viewport.width}px`,
          url,
          async (a) => {
            const o = await overflow(a.page);
            if (o)
              await a.find({
                category: 'mobile',
                rule: 'horizontal-overflow',
                severity: 'medium',
                confidence: 'high',
                title: 'Layout overflows the viewport',
                description: `Content is ${o.width}px wide inside a ${o.viewport}px viewport. Horizontal scrolling is required.`,
                whyItMatters:
                  'Off-screen content and actions are easy to miss on small screens.',
                selector: o.selector,
                reproduction: [
                  `Open ${url}`,
                  `Resize the viewport to ${viewport.width}×${viewport.height}`,
                  'Scroll horizontally and inspect the overflowing content.',
                ],
                personalityLine:
                  '320 pixels wide. Your layout brought extra luggage.',
                metadata: o,
              });
            const cs = await controls(a.page);
            const affected: {
              selector: string;
              label: string;
              kind: string;
            }[] = [];
            for (const c of cs.slice(0, 20)) {
              const hit = await a.page.locator(c.selector).evaluate((el) => {
                const r = el.getBoundingClientRect();
                const x = r.left + r.width / 2;
                const y = r.top + r.height / 2;
                if (r.left >= innerWidth || r.right < 0)
                  return { kind: 'outside', blocker: '' };
                if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight)
                  return undefined;
                const covering = document.elementFromPoint(x, y);
                if (
                  covering &&
                  covering !== el &&
                  !el.contains(covering) &&
                  !covering.contains(el)
                ) {
                  const s = getComputedStyle(covering);
                  if (s.position === 'fixed' || s.position === 'sticky')
                    return {
                      kind: 'covered',
                      blocker: covering.id
                        ? '#' + covering.id
                        : covering.tagName.toLowerCase(),
                    };
                }
                return undefined;
              });
              if (hit)
                affected.push({
                  selector: c.selector,
                  label: c.label,
                  kind: hit.kind,
                });
              if (
                hit &&
                !affected.slice(0, -1).some((c) => c.kind === hit.kind)
              )
                await a.find({
                  category: 'mobile',
                  rule: `control-${hit.kind}`,
                  severity: 'high',
                  confidence: 'high',
                  title:
                    hit.kind === 'outside'
                      ? 'Control sits outside the visible width'
                      : 'Fixed overlay blocks a control',
                  description:
                    hit.kind === 'outside'
                      ? `“${c.label}” is entirely outside the viewport's horizontal bounds.`
                      : `“${c.label}” has its center covered by ${hit.blocker}.`,
                  whyItMatters:
                    'Users cannot reliably reach the action without discovering a workaround.',
                  selector: c.selector,
                  reproduction: [
                    `Open ${url}`,
                    `Resize to ${viewport.width}×${viewport.height}`,
                    `Try to activate “${c.label}”.`,
                  ],
                  personalityLine:
                    hit.kind === 'outside'
                      ? 'Your navigation has left the building.'
                      : 'Nice button. Shame about the thing on top of it.',
                  metadata: {
                    ...hit,
                    label: c.label,
                    affectedControls: affected,
                  },
                });
            }
          },
          viewport,
        );
      }
  },
};
