import { actionReason } from '../safety/index.js';
import { controls, formSelectors, overflow } from '../discovery/index.js';
import type { Gremlin } from '../core/types.js';

export const forms: Gremlin = {
  id: 'forms',
  name: 'Forms',
  description:
    'Empty, invalid, whitespace, and long values; observe submission and layout.',
  async run(ctx) {
    for (const url of ctx.routes)
      for (const variant of [
        'empty',
        'invalid',
        'whitespace',
        'long',
      ] as const) {
        await ctx.test(
          `forms:${variant}`,
          `${variant} form input`,
          url,
          async (a) => {
            const fs = await formSelectors(a.page);
            if (!fs.length) a.skip('Forms', 'No forms discovered.');
            let tested = 0;
            for (const selector of fs) {
              const form = a.page.locator(selector);
              const info = await form.evaluate((el) => ({
                action: (el as HTMLFormElement).action,
                text: el.textContent?.slice(0, 240) || '',
                sensitive: !!el.querySelector(
                  'input[type=password],input[type=file],input[autocomplete*=cc-]',
                ),
              }));
              const buttons = await controls(a.page, selector);
              const submit = buttons.find(
                (c) =>
                  (c.tag === 'button' && (!c.type || c.type === 'submit')) ||
                  c.type === 'submit',
              );
              if (
                info.sensitive ||
                !submit ||
                !a.allowed(submit.label, info.action) ||
                !!actionReason(info.text, { ...ctx.config, allowedActions: [] })
              )
                continue;
              const inputs = form.locator(
                'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]),textarea',
              );
              if (!(await inputs.count())) continue;
              const before = await overflow(a.page);
              await form.evaluate((el) => {
                (
                  window as unknown as { __gremlinSubmits: number }
                ).__gremlinSubmits = 0;
                el.addEventListener(
                  'submit',
                  () =>
                    (window as unknown as { __gremlinSubmits: number })
                      .__gremlinSubmits++,
                  true,
                );
              });
              const fields: {
                type: string;
                required: boolean;
                value: string;
                name: string;
              }[] = [];
              for (let i = 0; i < Math.min(await inputs.count(), 8); i++) {
                const input = inputs.nth(i);
                if (!(await input.isVisible()) || !(await input.isEditable()))
                  continue;
                const type = (await input.getAttribute('type')) || 'text';
                if (
                  ![
                    'text',
                    'email',
                    'url',
                    'tel',
                    'search',
                    'number',
                    '',
                  ].includes(type) &&
                  (await input.evaluate((e) => e.tagName !== 'TEXTAREA'))
                )
                  continue;
                let value: string =
                  variant === 'empty'
                    ? ''
                    : variant === 'whitespace'
                      ? '   '
                      : variant === 'long'
                        ? 'G'.repeat(1024)
                        : 'not-an-email';
                if (type === 'number')
                  value =
                    variant === 'empty' || variant === 'whitespace'
                      ? ''
                      : '-999999999';
                await input.fill(value);
                fields.push({
                  type,
                  required: await input.evaluate(
                    (e) =>
                      e.hasAttribute('required') ||
                      e.getAttribute('aria-required') === 'true',
                  ),
                  value: await input.inputValue(),
                  name: (await input.getAttribute('name')) || type,
                });
              }
              if (!fields.length) continue;
              tested++;
              if (variant === 'long') {
                await a.settle();
                const after = await overflow(a.page);
                if (after && (!before || after.width > before.width + 40))
                  await a.find({
                    category: 'forms',
                    rule: 'long-value-overflow',
                    severity: 'medium',
                    confidence: 'high',
                    title: 'Long input breaks the layout',
                    description: `Pasting 1,024 characters increases the document width to ${after.width}px.`,
                    whyItMatters:
                      'Pasted content should remain inside the interface instead of pushing actions off-screen.',
                    selector,
                    reproduction: [
                      `Open ${url}`,
                      `Paste 1,024 characters into ${selector}`,
                      'Observe horizontal scrolling.',
                    ],
                    personalityLine:
                      'I pasted a paragraph. Your form became a runway.',
                    metadata: { before, after },
                  });
                continue;
              }
              const errorsBefore = a.observation.errors.length;
              await a.page.locator(submit.selector).click({ timeout: 1500 });
              await a.settle();
              const submitted = await a.page
                .evaluate(
                  () =>
                    (window as unknown as { __gremlinSubmits?: number })
                      .__gremlinSubmits || 0,
                )
                .catch(() => 0);
              const bad = fields.filter((f) =>
                variant === 'invalid'
                  ? f.type === 'email' || f.type === 'url'
                  : f.required && !f.value.trim(),
              );
              const feedback = await a.page
                .locator(
                  '[role=alert], [aria-invalid=true], .error, [class*=error-message]',
                )
                .filter({ visible: true })
                .count();
              if (submitted && bad.length && !feedback)
                await a.find({
                  category: 'forms',
                  rule: `${variant}-submission`,
                  severity: variant === 'invalid' ? 'medium' : 'high',
                  confidence: 'high',
                  title: `${variant === 'invalid' ? 'Invalid' : variant === 'whitespace' ? 'Whitespace-only' : 'Empty required'} values reach the submit handler`,
                  description: `${submitted} submit event(s) fired with ${bad.length} ${variant} field(s) and no recognized visible validation feedback. Backend acceptance is not asserted; network writes are blocked.`,
                  whyItMatters:
                    'Users need timely validation before the application attempts a submission.',
                  selector,
                  reproduction: [
                    `Open ${url}`,
                    `${variant === 'empty' ? 'Clear' : variant === 'whitespace' ? 'Enter only spaces in' : 'Enter “not-an-email” in'} the fields in ${selector}`,
                    `Activate “${submit.label}”`,
                    'Observe the submit event and missing inline validation.',
                  ],
                  personalityLine:
                    variant === 'empty'
                      ? 'Your form tried to submit absolutely nothing. Impressive.'
                      : 'My input made no sense. Your form nodded.',
                  metadata: {
                    submitted,
                    fields: bad.map((f) => ({
                      name: f.name,
                      type: f.type,
                      required: f.required,
                    })),
                    errorsDuringSubmit:
                      a.observation.errors.length - errorsBefore,
                  },
                });
            }
            if (!tested)
              a.skip(
                'Forms',
                'No safe, editable form found (authentication and destructive forms are excluded).',
              );
          },
        );
      }
  },
};
