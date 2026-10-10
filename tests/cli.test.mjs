import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const cli = resolve('dist/cli/index.js');
const exec = (args, cwd) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd });
test('CLI exposes a useful zero-configuration path', () => {
  assert.ok(exec(['--help']).stdout.includes('gremlin <URL>'));
  assert.equal(exec(['--version']).stdout.trim(), 'gremlin-ui 0.1.0');
  const listed = exec(['list']);
  assert.equal(listed.status, 0);
  assert.ok(listed.stdout.includes('chaos'));
});
test('CLI rejects remote targets, bad options, and unavailable servers cleanly', () => {
  for (const args of [
    ['https://example.com'],
    ['file:///tmp/test'],
    ['http://localhost:3000', '--gremlin', 'fake'],
    ['http://localhost:3000', '--timeout', 'nope'],
    ['http://localhost:3000', '--fail-on', 'fake'],
    ['--unknown'],
  ]) {
    const r = exec(args);
    assert.equal(r.status, 2);
    assert.ok(!r.stderr.includes('at main'));
  }
  const r = exec(['http://127.0.0.1:1', '--no-install']);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes('server is running'));
});
test('init writes valid configuration and protects an existing file', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'gremlin-init-'));
  try {
    assert.equal(exec(['init'], cwd).status, 0);
    const before = await readFile(join(cwd, 'gremlin.config.json'), 'utf8');
    assert.ok(JSON.parse(before).gremlins.includes('forms'));
    assert.equal(exec(['init'], cwd).status, 2);
    assert.equal(
      await readFile(join(cwd, 'gremlin.config.json'), 'utf8'),
      before,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
