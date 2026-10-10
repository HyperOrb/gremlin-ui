import type { Browser, Page } from 'playwright';

export const families = [
  'mobile',
  'forms',
  'navigation',
  'keyboard',
  'chaos',
] as const;
export type Family = (typeof families)[number];
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export interface Viewport {
  width: number;
  height: number;
}
export interface Config {
  gremlins: Family[];
  includeRoutes: string[];
  excludeRoutes: string[];
  allowedActions: string[];
  deniedActions: string[];
  dangerousKeywords: string[];
  viewports: Viewport[];
  maxPages: number;
  timeout: number;
  settleMs: number;
  screenshots: boolean;
  storageState?: string;
}
export interface Finding {
  id: string;
  rule: string;
  category: string;
  severity: Severity;
  confidence: 'high' | 'medium';
  title: string;
  description: string;
  whyItMatters: string;
  url: string;
  selector?: string;
  screenshot?: string;
  reproduction: string[];
  personalityLine: string;
  viewport: Viewport;
  metadata: Record<string, unknown>;
}
export type FindingInput = Omit<
  Finding,
  'id' | 'url' | 'viewport' | 'screenshot' | 'metadata'
> & { metadata?: Record<string, unknown> };
export interface Scenario {
  id: string;
  category: string;
  title: string;
  url: string;
  viewport: Viewport;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  findingIds: string[];
  durationMs: number;
  reason?: string;
}
export interface SkippedAction {
  url: string;
  action: string;
  reason: string;
}
export interface Report {
  schemaVersion: 1;
  environment: {
    node: string;
    platform: string;
    arch: string;
    browser: string;
  };
  tool: { name: 'gremlin-ui'; version: '0.1.0' };
  target: string;
  startedAt: string;
  durationMs: number;
  status: 'complete' | 'partial';
  config: Config;
  safety: {
    networkWritesBlocked: true;
    externalRequestsBlocked: true;
    websocketsBlocked: true;
  };
  score: {
    value: number | null;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    formula: string;
  };
  findings: Finding[];
  scenarios: Scenario[];
  skippedActions: SkippedAction[];
  warnings: string[];
}
export interface Observation {
  mutations: { method: string; url: string; body: string | null }[];
  errors: string[];
}
export interface Attack {
  page: Page;
  observation: Observation;
  find(input: FindingInput): Promise<void>;
  skip(action: string, reason: string): void;
  allowed(action: string, route?: string): boolean;
  settle(): Promise<void>;
}
export interface GremlinContext {
  browser: Browser;
  config: Config;
  target: string;
  routes: string[];
  test(
    id: string,
    title: string,
    url: string,
    run: (attack: Attack) => Promise<void>,
    viewport?: Viewport,
  ): Promise<void>;
}
export interface Gremlin {
  id: string;
  name: string;
  description: string;
  run(context: GremlinContext): Promise<void>;
}
