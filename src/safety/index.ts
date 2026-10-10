import type { BrowserContext } from 'playwright';
import type { Config, Observation, SkippedAction } from '../core/types.js';

const dangerous =
  /\b(delete|remove|purchase|pay|payment|checkout|send|publish|deploy|terminate|unsubscribe|logout|log\s*out|sign\s*out|billing|buy|order|transfer|donate|cancel\s+subscription)\b/i;
export function isLocal(url: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
}
export function targetURL(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      'Give Gremlin a complete URL, such as http://localhost:3000.',
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('Use an HTTP(S) URL without embedded credentials.');
  url.hash = '';
  return url.href;
}
export function matches(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(path);
}
export function actionReason(
  label: string,
  config: Config,
): string | undefined {
  const decoded = (() => {
    try {
      return decodeURIComponent(label);
    } catch {
      return label;
    }
  })().replace(/[_\-/]/g, ' ');
  if (
    dangerous.test(decoded) ||
    config.dangerousKeywords.some(
      (k) => k && decoded.toLowerCase().includes(k.toLowerCase()),
    )
  )
    return 'Potentially destructive action; always denied.';
  if (config.deniedActions.some((p) => matches(label, p)))
    return 'Action matched deniedActions.';
  if (
    config.allowedActions.length &&
    !config.allowedActions.some((p) => matches(label, p))
  )
    return 'Action not in allowedActions.';
}
export function routeReason(
  url: string,
  target: string,
  config: Config,
): string | undefined {
  const u = new URL(url, target);
  if (u.origin !== new URL(target).origin)
    return 'External origin; exploration stays on the target origin.';
  if (dangerous.test(decodeURIComponent(u.pathname).replace(/[_\-/]/g, ' ')))
    return 'Potentially destructive route; always denied.';
  if (config.excludeRoutes.some((p) => matches(u.pathname, p)))
    return 'Route matched excludeRoutes.';
}
export async function guard(
  context: BrowserContext,
  target: string,
  config: Config,
  observation: Observation,
  skip: (s: SkippedAction) => void,
): Promise<void> {
  const origin = new URL(target).origin;
  await context.route('**/*', async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(r.method());
    const reason =
      u.origin !== origin
        ? 'External network request blocked.'
        : (routeReason(r.url(), target, config) ??
          (write
            ? 'Network write blocked; intent recorded, backend untouched.'
            : undefined));
    if (reason) {
      if (write && u.origin === origin)
        observation.mutations.push({
          method: r.method(),
          url: r.url(),
          body: r.postData(),
        });
      skip({ url: r.url(), action: `${r.method()} ${u.pathname}`, reason });
      // Explicit error response avoids inventing successful server behavior.
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: '{"gremlinBlocked":true,"error":"GREMLIN_SAFETY_BLOCK"}',
      });
    } else {
      // Playwright does not re-route HTTP redirect chains. Fetch without following
      // redirects, and inspect every destination before it can reach the network.
      try {
        let response = await route.fetch({
          maxRedirects: 0,
          timeout: config.timeout,
        });
        let current = r.url();
        for (let hop = 0; hop < 10; hop++) {
          const location = response.headers()['location'];
          if (
            response.status() < 300 ||
            response.status() >= 400 ||
            !location
          ) {
            await route.fulfill({ response });
            await response.dispose();
            return;
          }
          const next = new URL(location, current).href;
          const denied = routeReason(next, target, config);
          if (denied) {
            skip({ url: next, action: 'HTTP redirect', reason: denied });
            await response.dispose();
            await route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: '{"gremlinBlocked":true,"error":"GREMLIN_REDIRECT_BLOCK"}',
            });
            return;
          }
          if (r.isNavigationRequest()) {
            // A new top-level navigation gets a fresh guarded request. Preserve
            // the canonical URL instead of silently proxying another page's HTML.
            const literal = JSON.stringify(next).replace(/</g, '\\u003c');
            await route.fulfill({
              status: 200,
              contentType: 'text/html',
              body:
                '<!doctype html><meta charset="utf-8"><title>Gremlin guarded redirect</title><script>location.replace(' +
                literal +
                ')</script>',
            });
            await response.dispose();
            return;
          }
          await response.dispose();
          current = next;
          response = await route.fetch({
            url: next,
            maxRedirects: 0,
            timeout: config.timeout,
          });
        }
        await response.dispose();
        skip({
          url: current,
          action: 'HTTP redirect',
          reason: 'Redirect chain exceeded 10 hops.',
        });
        await route.abort('failed');
      } catch {
        await route.abort('failed').catch(() => {});
      }
    }
  });
  await context.routeWebSocket('**/*', (ws) => {
    skip({
      url: ws.url(),
      action: 'WebSocket',
      reason: 'WebSockets blocked to prevent uninspected writes.',
    });
    ws.close();
  });
  await context.addInitScript(() => {
    // These transports cannot be fully inspected through HTTP routing.
    Object.defineProperty(navigator, 'sendBeacon', { value: () => false });
    Object.defineProperty(window, 'RTCPeerConnection', {
      value: undefined,
      configurable: true,
    });
  });
}
