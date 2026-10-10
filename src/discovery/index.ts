import type { Page } from 'playwright';
export interface Control {
  selector: string;
  label: string;
  tag: string;
  type: string;
  href?: string;
}
export async function controls(page: Page, root = 'body'): Promise<Control[]> {
  return page.locator(root).evaluate((element) => {
    function selector(el: Element): string {
      if (el.id) return '#' + CSS.escape(el.id);
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.documentElement) {
        const index = current.parentElement
          ? Array.from(current.parentElement.children)
              .filter((e) => e.tagName === current!.tagName)
              .indexOf(current) + 1
          : 1;
        parts.unshift(
          current.tagName.toLowerCase() + ':nth-of-type(' + index + ')',
        );
        current = current.parentElement;
      }
      return parts.join(' > ');
    }
    return Array.from(
      element.querySelectorAll(
        'a[href],button,input[type=submit],[role=button],[onclick]',
      ),
    )
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== 'hidden' &&
          s.display !== 'none'
        );
      })
      .slice(0, 60)
      .map((el) => ({
        selector: selector(el),
        label: (
          (el.getAttribute('aria-label') ||
            el.textContent ||
            el.getAttribute('value') ||
            '') +
          ' ' +
          (el.getAttribute('name') || '')
        )
          .trim()
          .slice(0, 240),
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        href: el instanceof HTMLAnchorElement ? el.href : undefined,
      }));
  });
}
export async function formSelectors(page: Page): Promise<string[]> {
  return page
    .locator('form')
    .evaluateAll((forms) =>
      forms
        .slice(0, 3)
        .map((el, i) => (el.id ? '#' + CSS.escape(el.id) : `form >> nth=${i}`)),
    );
}
export async function fingerprint(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify({
      url: location.href,
      body: document.body.innerText,
      checked: Array.from(document.querySelectorAll('input')).map((e) => [
        e.type,
        e.checked,
        e.value,
      ]),
      expanded: Array.from(
        document.querySelectorAll('[aria-expanded],[open]'),
      ).map((e) => e.outerHTML),
      dialogs: document.querySelectorAll('dialog[open]').length,
    }),
  );
}
export async function overflow(
  page: Page,
): Promise<
  | { width: number; viewport: number; selector: string; text: string }
  | undefined
> {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const width = Math.max(
      document.body.scrollWidth,
      document.documentElement.scrollWidth,
    );
    if (width <= viewport + 4) return undefined;
    const el = Array.from(document.body.querySelectorAll('*')).find((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        r.width > 0 &&
        s.position !== 'fixed' &&
        s.visibility !== 'hidden' &&
        (r.right > viewport + 4 || r.left < -4)
      );
    });
    return {
      width,
      viewport,
      selector: el?.id
        ? '#' + CSS.escape(el.id)
        : el?.tagName.toLowerCase() || 'body',
      text: el?.textContent?.slice(0, 120) || '',
    };
  });
}
