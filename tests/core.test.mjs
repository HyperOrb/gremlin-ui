import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, validateConfig } from '../dist/core/config.js';
import {
  actionReason,
  routeReason,
  targetURL,
  matches,
  isLocal,
} from '../dist/safety/index.js';
import { score } from '../dist/core/score.js';
import { html } from '../dist/reporters/html.js';

const target = 'http://localhost:3000/';
test('dangerous actions cannot be allowed by an action allowlist', () => {
  for (const label of [
    'Delete account',
    'Purchase',
    'Pay now',
    'Send message',
    'Publish',
    'Deploy',
    'Cancel subscription',
    '/api/remove',
    'Confirm payment',
    'Log out',
  ])
    assert.ok(
      actionReason(label, { ...defaults, allowedActions: [label] }),
      label,
    );
  assert.equal(actionReason('Generate preview', defaults), undefined);
});
test('route policy blocks destructive, excluded, and external URLs', () => {
  for (const route of [
    '/api/delete',
    '/checkout',
    'https://elsewhere.test/foo',
    '/api/%70urchase',
  ])
    assert.ok(routeReason(route, target, defaults), route);
  assert.ok(
    routeReason('/admin/settings', target, {
      ...defaults,
      excludeRoutes: ['/admin/*'],
    }),
  );
  assert.equal(routeReason('/guide', target, defaults), undefined);
  assert.equal(matches('/admin/a', '/admin/*'), true);
  assert.equal(matches('/guide', '/guide.'), false);
});
test('target parsing refuses non-web protocols and credentials', () => {
  for (const raw of [
    'localhost:3000',
    'file:///etc/passwd',
    'https://a:b@example.com',
    'not-a-url',
  ])
    assert.throws(() => targetURL(raw));
  assert.equal(targetURL('http://localhost:3000/#foo'), target);
  assert.equal(isLocal('http://127.0.0.1:3000'), true);
  assert.equal(isLocal('http://localhost.evil.test'), false);
});
test('configuration rejects misleading or unbounded options', () => {
  for (const config of [
    { seed: 'fake' },
    { gremlins: ['oops'] },
    { timeout: 0 },
    { maxPages: 100 },
    { screenshots: 'yes' },
    { viewports: [{ width: 0, height: 800 }] },
    { excludeRoutes: 42 },
  ])
    assert.throws(() => validateConfig(config));
  assert.deepEqual(validateConfig({}), defaults);
});
test('survival score excludes untested scenarios and never makes up a score', () => {
  const s = score(
    ['passed', 'failed', 'skipped', 'error'].map((status) => ({ status })),
  );
  assert.deepEqual(
    [s.value, s.passed, s.failed, s.skipped, s.errors],
    [50, 1, 1, 1, 1],
  );
  assert.equal(score([{ status: 'skipped' }]).value, null);
  assert.equal(score([]).value, null);
});
test('HTML escapes app-controlled strings and rejects unsafe links', () => {
  const attack = '<img src=x onerror="alert(1)">';
  const report = {
    status: 'complete',
    target: 'javascript:alert(1)',
    score: score([{ status: 'failed' }]),
    durationMs: 100,
    scenarios: [],
    skippedActions: [{ action: attack, reason: attack, url: attack }],
    findings: [
      {
        id: 'GR-123',
        category: 'forms',
        severity: 'high',
        confidence: 'high',
        title: attack,
        description: attack,
        personalityLine: attack,
        url: attack,
        selector: attack,
        reproduction: [attack],
        whyItMatters: attack,
        viewport: { width: 320, height: 740 },
        metadata: { attack },
        screenshot: 'javascript:alert(1)',
      },
    ],
    config: defaults,
    warnings: [],
  };
  const rendered = html(report);
  assert.ok(rendered.includes('&lt;img'));
  assert.ok(!rendered.includes('<img src=x'));
  assert.ok(!rendered.includes('href="javascript:'));
  assert.ok(!rendered.includes('src="javascript:'));
});
