import { readFile } from 'node:fs/promises';
import { families, type Config } from './types.js';

export const defaults: Config = {
  gremlins: [...families],
  includeRoutes: [],
  excludeRoutes: [],
  allowedActions: [],
  deniedActions: [],
  dangerousKeywords: [],
  viewports: [
    { width: 320, height: 740 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ],
  maxPages: 3,
  timeout: 10000,
  settleMs: 250,
  screenshots: true,
};
export function validateConfig(input: unknown): Config {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Configuration must be a JSON object.');
  const x = input as Record<string, unknown>;
  for (const key of Object.keys(x))
    if (!(key in defaults) && key !== 'storageState')
      throw new Error(`Unknown configuration key: ${key}`);
  const c = { ...defaults, ...x } as Config;
  for (const key of [
    'gremlins',
    'includeRoutes',
    'excludeRoutes',
    'allowedActions',
    'deniedActions',
    'dangerousKeywords',
  ] as const) {
    if (!Array.isArray(c[key]) || c[key].some((v) => typeof v !== 'string'))
      throw new Error(`${key} must be an array of strings.`);
  }
  if (!c.gremlins.length || c.gremlins.some((g) => !families.includes(g)))
    throw new Error(`gremlins must contain: ${families.join(', ')}`);
  for (const [key, min, max] of [
    ['maxPages', 1, 20],
    ['timeout', 1000, 120000],
    ['settleMs', 0, 5000],
  ] as const) {
    if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max)
      throw new Error(`${key} must be an integer between ${min} and ${max}.`);
  }
  if (
    !Array.isArray(c.viewports) ||
    !c.viewports.length ||
    c.viewports.length > 10 ||
    c.viewports.some(
      (v) =>
        !v ||
        !Number.isInteger(v.width) ||
        !Number.isInteger(v.height) ||
        v.width < 240 ||
        v.width > 3840 ||
        v.height < 240 ||
        v.height > 2160,
    )
  )
    throw new Error(
      'viewports must contain 1–10 sizes between 240×240 and 3840×2160.',
    );
  if (typeof c.screenshots !== 'boolean')
    throw new Error('screenshots must be boolean.');
  if (c.storageState !== undefined && typeof c.storageState !== 'string')
    throw new Error('storageState must be a file path.');
  return c;
}
export async function loadConfig(
  path = 'gremlin.config.json',
): Promise<Config> {
  try {
    return validateConfig(JSON.parse(await readFile(path, 'utf8')));
  } catch (e) {
    if (
      (e as NodeJS.ErrnoException).code === 'ENOENT' &&
      path === 'gremlin.config.json'
    )
      return validateConfig({});
    throw e;
  }
}
