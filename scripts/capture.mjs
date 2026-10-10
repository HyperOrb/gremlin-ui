import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// Replay actual stored artifacts, never fabricated CLI output or findings.
const report = JSON.parse(
  await readFile('artifacts/broken/report.json', 'utf8'),
);
const transcript = await readFile('artifacts/broken/terminal.txt', 'utf8');
const lines = transcript.split('\n');
const summary = lines.findIndex((l) => l.includes('GREMLIN SURVIVAL REPORT'));
const selected = [
  ...lines.slice(0, summary),
  ...lines.slice(summary, summary + 11),
].join('\n');
const e = (x) =>
  x.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
await mkdir('assets', { recursive: true });
await mkdir('artifacts/capture', { recursive: true });
const terminal = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#10120f;color:#f1f3ea;font:22px/1.6 ui-monospace,monospace;padding:50px;box-sizing:border-box}h1{color:#c4f65c;font:900 32px system-ui;margin:0 0 20px}pre{white-space:pre-wrap;font:inherit;margin:0}.caption{color:#aab6a1;font-size:14px;margin-top:20px}</style><h1>👹 GREMLIN_</h1><pre>${e(selected)}</pre><p class="caption">Actual CLI transcript · artifact replay · ${e(report.startedAt)}</p>`;
await writeFile('artifacts/capture/terminal.html', terminal);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto(
    pathToFileURL(resolve('artifacts/capture/terminal.html')).href,
  );
  await page.screenshot({ path: 'artifacts/capture/01.png' });
  const finding =
    report.findings.find((f) => f.rule === 'control-outside') ||
    report.findings.find((f) => f.rule === 'horizontal-overflow');
  if (!finding?.screenshot)
    throw new Error('Capture needs a real mobile finding screenshot.');
  const source = pathToFileURL(
    resolve('artifacts/broken', finding.screenshot),
  ).href;
  const evidence = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#10120f;color:#f1f3ea;font:20px/1.5 system-ui;padding:40px}h1{font-size:36px;margin:10px 0;color:#c4f65c}img{height:630px;max-width:100%;object-fit:contain;object-position:top left;margin-top:16px}.meta{font:14px ui-monospace,monospace;color:#b0b9a6}</style><div class="meta">REAL BROWSER EVIDENCE / ${e(finding.id)} / ${finding.viewport.width}×${finding.viewport.height}</div><h1>${e(finding.title)}</h1><div>${e(finding.description)}</div><img src="${source}" alt="Real finding screenshot">`;
  await writeFile('artifacts/capture/evidence.html', evidence);
  await page.goto(
    pathToFileURL(resolve('artifacts/capture/evidence.html')).href,
  );
  await page.screenshot({ path: 'artifacts/capture/02.png' });
  await page.goto(pathToFileURL(resolve('artifacts/broken/report.html')).href);
  await page.screenshot({ path: 'artifacts/capture/03.png' });
  await page.screenshot({ path: 'assets/report.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'artifacts/capture/report-mobile.png',
    fullPage: true,
  });
} finally {
  await browser.close();
}
const manifest =
  [1, 2, 3]
    .map((i) => `file '${resolve(`artifacts/capture/0${i}.png`)}'\nduration 5`)
    .join('\n') + `\nfile '${resolve('artifacts/capture/03.png')}'\n`;
await writeFile('artifacts/capture/frames.txt', manifest);
const ffmpeg = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'artifacts/capture/frames.txt',
    '-vf',
    'fps=8,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
    '-loop',
    '0',
    'assets/demo.gif',
  ],
  { encoding: 'utf8' },
);
if (ffmpeg.error?.code === 'ENOENT') {
  console.error(
    'Screenshots captured. Install ffmpeg, then rerun: node scripts/capture.mjs',
  );
  process.exitCode = 2;
} else if (ffmpeg.status !== 0) {
  console.error(ffmpeg.stderr);
  process.exitCode = 2;
} else
  console.log(
    'Created assets/demo.gif: 15-second replay of real CLI output, browser evidence, and HTML report. No fabricated output.',
  );
