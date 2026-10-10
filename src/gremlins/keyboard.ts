import { controls, fingerprint } from '../discovery/index.js';
import type { Gremlin } from '../core/types.js';

export const keyboard: Gremlin = {
  id: 'keyboard',
  name: 'Keyboard flow',
  description:
    'Tab and Shift+Tab; inspect focus indication and pointer-only custom controls.',
  async run(ctx) {
    for (const url of ctx.routes) {
      await ctx.test(
        'keyboard:focus',
        'Visible focus through Tab order',
        url,
        async (a) => {
          const seen = new Set<string>();
          let focused = 0;
          const affected: { selector: string; label: string }[] = [];
          for (let i = 0; i < 24; i++) {
            await a.page.keyboard.press('Tab');
            const state = await a.page.evaluate(() => {
              const el = document.activeElement as HTMLElement | null;
              if (!el || el === document.body) return undefined;
              const style = getComputedStyle(el);
              const parts: string[] = [];
              let current: Element | null = el;
              while (current && current !== document.documentElement) {
                const node: Element = current;
                const index = node.parentElement
                  ? Array.from(node.parentElement.children)
                      .filter((e) => e.tagName === node.tagName)
                      .indexOf(node) + 1
                  : 1;
                parts.unshift(
                  node.tagName.toLowerCase() + ':nth-of-type(' + index + ')',
                );
                current = node.parentElement;
              }
              const selector = el.id
                ? '#' + CSS.escape(el.id)
                : parts.join(' > ');
              return {
                selector,
                label: (
                  el.getAttribute('aria-label') ||
                  el.textContent ||
                  el.getAttribute('name') ||
                  el.tagName
                ).slice(0, 120),
                outline:
                  style.outlineStyle !== 'none' &&
                  parseFloat(style.outlineWidth) > 0 &&
                  style.outlineColor !== 'rgba(0, 0, 0, 0)',
                shadow: style.boxShadow !== 'none',
                visible: el.matches(':focus-visible'),
              };
            });
            if (!state) continue;
            if (seen.has(state.selector + state.label)) break;
            seen.add(state.selector + state.label);
            focused++;
            if (!state.outline && !state.shadow && state.visible) {
              // Compare unfocused and focused computed styles: borders/background can be valid indicators.
              const changed = await a.page.evaluate(() => {
                const el = document.activeElement as HTMLElement;
                const properties = [
                  'backgroundColor',
                  'borderTopColor',
                  'borderTopWidth',
                  'color',
                  'textDecorationLine',
                  'opacity',
                  'transform',
                ] as const;
                const before = properties.map((p) => getComputedStyle(el)[p]);
                el.blur();
                const after = properties.map((p) => getComputedStyle(el)[p]);
                el.focus();
                const own = before.some((v, i) => v !== after[i]);
                const parent = el.parentElement;
                return (
                  own ||
                  (!!parent &&
                    (getComputedStyle(parent).outlineStyle !== 'none' ||
                      getComputedStyle(parent).boxShadow !== 'none'))
                );
              });
              if (!changed) {
                affected.push({ selector: state.selector, label: state.label });
                if (affected.length === 1)
                  await a.find({
                    category: 'keyboard',
                    rule: 'no-visible-focus',
                    severity: 'medium',
                    confidence: 'medium',
                    title: 'Keyboard focus has no detected visual indicator',
                    description: `“${state.label}” receives keyboard focus but has no detected outline, shadow, or focus-dependent style change. Additional affected controls are grouped in metadata. Pseudo-elements and distant focus-within styling need manual review.`,
                    whyItMatters:
                      'Users tabbing through the page need to know which control Enter will activate.',
                    selector: state.selector,
                    reproduction: [
                      `Open ${url}`,
                      `Press Tab ${i + 1} time(s)`,
                      `Inspect focus on “${state.label}”.`,
                    ],
                    personalityLine:
                      'I used Tab. Your focus entered stealth mode.',
                    metadata: { affectedControls: affected },
                  });
              }
            }
          }
          await a.page.keyboard.press('Shift+Tab');
          await a.page.keyboard.press('Escape');
          if (!focused)
            a.skip('Keyboard focus', 'No focusable controls discovered.');
        },
      );
      await ctx.test(
        'keyboard:custom-controls',
        'Custom control keyboard activation',
        url,
        async (a) => {
          const cs = (await controls(a.page)).filter(
            (c) => !['button', 'a', 'input'].includes(c.tag),
          );
          let tested = 0;
          for (const c of cs.slice(0, 4)) {
            if (!a.allowed(c.label)) continue;
            tested++;
            const reachable = await a.page
              .locator(c.selector)
              .evaluate((el) => (el as HTMLElement).tabIndex >= 0);
            if (!reachable)
              await a.find({
                category: 'keyboard',
                rule: 'pointer-only-control',
                severity: 'high',
                confidence: 'high',
                title: 'Custom interactive control is absent from Tab order',
                description: `“${c.label}” is a custom role/click-handler control with tabIndex < 0. It cannot be reached using normal Tab navigation.`,
                whyItMatters:
                  'A working pointer action is still unusable for people navigating with a keyboard.',
                selector: c.selector,
                reproduction: [
                  `Open ${url}`,
                  `Press Tab through the page and try to reach “${c.label}”`,
                  'Compare with pointer activation.',
                ],
                personalityLine:
                  'Your mouse got an invitation. Your keyboard did not.',
              });
            else {
              await a.page.locator(c.selector).focus();
              const before = await fingerprint(a.page);
              await a.page.keyboard.press('Enter');
              await a.settle();
              const entered = await fingerprint(a.page);
              if (before === entered) {
                await a.page.locator(c.selector).click();
                await a.settle();
                if (before !== (await fingerprint(a.page)))
                  await a.find({
                    category: 'keyboard',
                    rule: 'enter-does-not-activate',
                    severity: 'high',
                    confidence: 'high',
                    title: 'Custom control responds to click but not Enter',
                    description: `Pointer activation changed the interface; Enter did not.`,
                    whyItMatters:
                      'Keyboard users should be able to activate a focusable button.',
                    selector: c.selector,
                    reproduction: [
                      `Open ${url}`,
                      `Focus “${c.label}” and press Enter`,
                      'Compare with clicking the same control.',
                    ],
                    personalityLine:
                      'Enter is a key. Apparently not to this door.',
                  });
              }
            }
          }
          if (!tested)
            a.skip(
              'Custom controls',
              'No safe custom interactive controls discovered.',
            );
        },
      );
    }
  },
};
