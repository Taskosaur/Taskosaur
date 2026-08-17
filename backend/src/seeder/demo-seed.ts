/**
 * Standalone demo seed: one coherent tech organisation, filled in from users all
 * the way down to time entries.
 *
 * Idempotent by construction — every write is an upsert keyed on a natural
 * unique constraint (or a deterministic UUID derived from a stable string), so
 * running it against a fresh database, a half-seeded one, or one that already
 * has this data produces the same result.
 *
 *   npm run seed:demo
 */
import { PrismaClient } from '@prisma/client';
import type {
  ProjectPriority,
  ProjectStatus,
  ProjectVisibility,
  Role,
  SprintStatus,
  StatusCategory,
  TaskPriority,
  TaskType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

/** Deterministic UUIDv5-shaped id, so re-runs reuse the same rows. */
function uid(key: string): string {
  const h = createHash('sha1').update(`taskosaur-demo:${key}`).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `5${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

const d = (iso: string) => new Date(`${iso}T09:00:00.000Z`);

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const DEMO_PASSWORD = 'password123';

interface SeedUser {
  key: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
  orgRole: Role;
  bio: string;
  timezone: string;
}

const USERS: SeedUser[] = [
  {
    key: 'admin',
    email: 'admin@taskosaur.com',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    role: 'SUPER_ADMIN',
    orgRole: 'OWNER',
    bio: 'Platform owner. Runs the Northwind Labs engineering org.',
    timezone: 'UTC',
  },
  {
    key: 'priya',
    email: 'priya.raghavan@northwindlabs.dev',
    username: 'priya.raghavan',
    firstName: 'Priya',
    lastName: 'Raghavan',
    role: 'MANAGER',
    orgRole: 'MANAGER',
    bio: 'Staff engineer, platform. Owns the API gateway and its rollout plan.',
    timezone: 'Asia/Kolkata',
  },
  {
    key: 'diego',
    email: 'diego.moreno@northwindlabs.dev',
    username: 'diego.moreno',
    firstName: 'Diego',
    lastName: 'Moreno',
    role: 'MEMBER',
    orgRole: 'MEMBER',
    bio: 'Backend engineer. Billing, metering, and everything money touches.',
    timezone: 'Europe/Madrid',
  },
  {
    key: 'hana',
    email: 'hana.kobayashi@northwindlabs.dev',
    username: 'hana.kobayashi',
    firstName: 'Hana',
    lastName: 'Kobayashi',
    role: 'MEMBER',
    orgRole: 'MEMBER',
    bio: 'Developer experience. CLI ergonomics, docs, and onboarding flows.',
    timezone: 'Asia/Tokyo',
  },
  {
    key: 'sam',
    email: 'samuel.adeyemi@northwindlabs.dev',
    username: 'samuel.adeyemi',
    firstName: 'Samuel',
    lastName: 'Adeyemi',
    role: 'MEMBER',
    orgRole: 'MEMBER',
    bio: 'Site reliability. Multi-region infrastructure, observability, on-call.',
    timezone: 'Africa/Lagos',
  },
];

const ORGANIZATION = {
  name: 'Northwind Labs',
  slug: 'northwind-labs',
  description:
    'Engineering organisation building the Northwind developer platform: API gateway, billing, and tooling.',
  website: 'https://northwindlabs.dev',
};

const WORKFLOW = {
  name: 'Engineering Delivery',
  description: 'Default delivery workflow for all Northwind Labs engineering projects.',
  statuses: [
    { name: 'Backlog', color: '#94A3B8', category: 'TODO' as StatusCategory, isDefault: true },
    { name: 'Ready', color: '#64748B', category: 'TODO' as StatusCategory },
    { name: 'In Progress', color: '#3B82F6', category: 'IN_PROGRESS' as StatusCategory },
    { name: 'In Review', color: '#A855F7', category: 'IN_PROGRESS' as StatusCategory },
    { name: 'Blocked', color: '#EF4444', category: 'IN_PROGRESS' as StatusCategory },
    { name: 'Done', color: '#22C55E', category: 'DONE' as StatusCategory },
  ],
  transitions: [
    ['Backlog', 'Ready', 'Groom'],
    ['Ready', 'Backlog', 'Send back to backlog'],
    ['Ready', 'In Progress', 'Start work'],
    ['In Progress', 'In Review', 'Open pull request'],
    ['In Progress', 'Blocked', 'Flag blocker'],
    ['Blocked', 'In Progress', 'Unblock'],
    ['In Review', 'In Progress', 'Request changes'],
    ['In Review', 'Done', 'Merge and ship'],
  ] as [string, string, string][],
};

const LABELS = [
  { name: 'backend', color: '#2563EB', description: 'Server-side work' },
  { name: 'frontend', color: '#DB2777', description: 'Client-side work' },
  { name: 'infrastructure', color: '#0891B2', description: 'Deploys, clusters, networking' },
  { name: 'security', color: '#DC2626', description: 'Security-sensitive change' },
  { name: 'performance', color: '#EA580C', description: 'Latency or throughput work' },
  { name: 'observability', color: '#7C3AED', description: 'Metrics, traces, logs' },
  { name: 'tech-debt', color: '#78716C', description: 'Paying down accumulated debt' },
  { name: 'documentation', color: '#16A34A', description: 'Docs and developer guides' },
];

const SPRINTS = [
  {
    slug: 'sprint-26-5-foundations',
    name: 'Sprint 26.5 — Foundations',
    goal: 'Land the structural pieces the rest of the quarter depends on.',
    status: 'COMPLETED' as SprintStatus,
    startDate: '2026-06-01',
    endDate: '2026-06-26',
  },
  {
    slug: 'sprint-26-6-hardening',
    name: 'Sprint 26.6 — Hardening',
    goal: 'Close correctness and security gaps found during the foundations work.',
    status: 'COMPLETED' as SprintStatus,
    startDate: '2026-06-29',
    endDate: '2026-07-24',
  },
  {
    slug: 'sprint-26-7-scale-out',
    name: 'Sprint 26.7 — Scale-Out',
    goal: 'Take the platform multi-region and prove it under production load.',
    status: 'ACTIVE' as SprintStatus,
    isDefault: true,
    startDate: '2026-07-27',
    endDate: '2026-08-21',
  },
  {
    slug: 'sprint-26-8-polish',
    name: 'Sprint 26.8 — Polish',
    goal: 'Documentation, ergonomics, and the long tail before GA.',
    status: 'PLANNING' as SprintStatus,
    startDate: '2026-08-24',
    endDate: '2026-09-18',
  },
];

interface SeedTask {
  key: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: string;
  sprint: string;
  parent?: string;
  blockedBy?: string[];
  assignees: string[];
  reporter: string;
  watchers?: string[];
  labels: string[];
  storyPoints?: number;
  /** minutes */
  originalEstimate?: number;
  remainingEstimate?: number;
  startDate: string;
  dueDate: string;
  completedAt?: string;
  comments?: { author: string; content: string }[];
  timeEntries?: { user: string; minutes: number; date: string; description: string }[];
}

interface SeedProject {
  slug: string;
  name: string;
  taskPrefix: string;
  description: string;
  color: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  visibility: ProjectVisibility;
  startDate: string;
  endDate: string;
  members: { user: string; role: Role }[];
  tasks: SeedTask[];
}

interface SeedWorkspace {
  slug: string;
  name: string;
  description: string;
  color: string;
  members: { user: string; role: Role }[];
  projects: SeedProject[];
}

const WORKSPACES: SeedWorkspace[] = [
  {
    slug: 'platform-engineering',
    name: 'Platform Engineering',
    description: 'Core runtime services every Northwind product is built on.',
    color: '#4F46E5',
    members: [
      { user: 'admin', role: 'OWNER' },
      { user: 'priya', role: 'MANAGER' },
      { user: 'diego', role: 'MEMBER' },
      { user: 'sam', role: 'MEMBER' },
    ],
    projects: [
      {
        slug: 'atlas-api-gateway',
        name: 'Atlas API Gateway',
        taskPrefix: 'ATLAS',
        description:
          'Edge gateway handling authentication, rate limiting, and routing for every public Northwind API.',
        color: '#6366F1',
        status: 'ACTIVE',
        priority: 'HIGH',
        visibility: 'INTERNAL',
        startDate: '2026-05-04',
        endDate: '2026-12-18',
        members: [
          { user: 'priya', role: 'OWNER' },
          { user: 'sam', role: 'MEMBER' },
          { user: 'diego', role: 'MEMBER' },
          { user: 'admin', role: 'MANAGER' },
        ],
        tasks: [
          {
            key: 'atlas-epic',
            title: 'Multi-region gateway rollout',
            description:
              'Run Atlas actively in three regions with health-based failover and no single-region dependency in the request path.',
            type: 'EPIC',
            priority: 'HIGHEST',
            status: 'In Progress',
            sprint: 'sprint-26-7-scale-out',
            assignees: ['priya'],
            reporter: 'admin',
            watchers: ['admin', 'sam'],
            labels: ['infrastructure', 'performance'],
            storyPoints: 21,
            originalEstimate: 4800,
            remainingEstimate: 2400,
            startDate: '2026-07-27',
            dueDate: '2026-09-18',
            comments: [
              {
                author: 'admin',
                content:
                  'Scope check: failover has to be automatic. A runbook step that a human executes at 3am does not count as multi-region.',
              },
              {
                author: 'priya',
                content:
                  'Agreed. Health-check driven, no manual step. Tracking the failover drill as part of the scale-out sprint.',
              },
            ],
          },
          {
            key: 'atlas-ratelimit',
            title: 'Token-bucket rate limiting per API key',
            description:
              'Replace the fixed-window limiter with a distributed token bucket so bursts are absorbed instead of rejected at the window edge.',
            type: 'STORY',
            priority: 'HIGH',
            status: 'In Review',
            sprint: 'sprint-26-7-scale-out',
            parent: 'atlas-epic',
            assignees: ['priya', 'diego'],
            reporter: 'admin',
            watchers: ['sam'],
            labels: ['backend', 'performance'],
            storyPoints: 8,
            originalEstimate: 1920,
            remainingEstimate: 360,
            startDate: '2026-07-27',
            dueDate: '2026-08-14',
            comments: [
              {
                author: 'diego',
                content:
                  'Bucket refill is Lua in Redis so the read-modify-write stays atomic. Benchmarked at 40k ops/sec on a single shard.',
              },
            ],
            timeEntries: [
              {
                user: 'priya',
                minutes: 420,
                date: '2026-07-29',
                description: 'Token bucket algorithm and refill maths',
              },
              {
                user: 'diego',
                minutes: 300,
                date: '2026-08-03',
                description: 'Redis Lua script and load test harness',
              },
              {
                user: 'priya',
                minutes: 240,
                date: '2026-08-10',
                description: 'Review feedback: clock skew handling',
              },
            ],
          },
          {
            key: 'atlas-redis',
            title: 'Redis cluster for rate-limit counters',
            description:
              'Provision a dedicated three-node Redis cluster per region so limiter state never crosses a region boundary.',
            type: 'SUBTASK',
            priority: 'MEDIUM',
            status: 'Done',
            sprint: 'sprint-26-6-hardening',
            parent: 'atlas-ratelimit',
            assignees: ['sam'],
            reporter: 'priya',
            labels: ['infrastructure'],
            storyPoints: 5,
            originalEstimate: 960,
            remainingEstimate: 0,
            startDate: '2026-06-29',
            dueDate: '2026-07-17',
            completedAt: '2026-07-16',
            timeEntries: [
              {
                user: 'sam',
                minutes: 480,
                date: '2026-07-02',
                description: 'Terraform module for regional Redis clusters',
              },
              {
                user: 'sam',
                minutes: 360,
                date: '2026-07-14',
                description: 'Failover testing and alert wiring',
              },
            ],
          },
          {
            key: 'atlas-headers',
            title: 'Emit RateLimit-* response headers',
            description:
              'Return the draft IETF RateLimit-Limit, RateLimit-Remaining, and RateLimit-Reset headers so clients can back off before they are throttled.',
            type: 'SUBTASK',
            priority: 'LOW',
            status: 'Ready',
            sprint: 'sprint-26-8-polish',
            parent: 'atlas-ratelimit',
            blockedBy: ['atlas-ratelimit'],
            assignees: ['diego'],
            reporter: 'priya',
            labels: ['backend', 'documentation'],
            storyPoints: 2,
            originalEstimate: 300,
            remainingEstimate: 300,
            startDate: '2026-08-24',
            dueDate: '2026-09-01',
          },
          {
            key: 'atlas-502',
            title: 'Upstream 502s are not retried on idempotent GETs',
            description:
              'A single upstream restart surfaces as a 502 to the caller. Idempotent methods should retry against another healthy instance before failing.',
            type: 'BUG',
            priority: 'HIGHEST',
            status: 'In Progress',
            sprint: 'sprint-26-7-scale-out',
            assignees: ['sam'],
            reporter: 'admin',
            watchers: ['priya', 'admin'],
            labels: ['backend', 'observability'],
            storyPoints: 5,
            originalEstimate: 720,
            remainingEstimate: 420,
            startDate: '2026-08-03',
            dueDate: '2026-08-19',
            comments: [
              {
                author: 'admin',
                content:
                  'Two customer reports this week, both during a routine upstream deploy. Treating this as the top bug for the sprint.',
              },
              {
                author: 'sam',
                content:
                  'Retry budget will be capped so a genuinely down upstream does not get hammered. One retry, different instance, GET and HEAD only.',
              },
            ],
            timeEntries: [
              {
                user: 'sam',
                minutes: 300,
                date: '2026-08-05',
                description: 'Reproduced with a rolling restart in staging',
              },
            ],
          },
          {
            key: 'atlas-mtls',
            title: 'mTLS between gateway and internal services',
            description:
              'Terminate public TLS at the edge and re-establish mutual TLS to every upstream, with certificates issued and rotated by the internal CA.',
            type: 'STORY',
            priority: 'HIGH',
            status: 'Blocked',
            sprint: 'sprint-26-7-scale-out',
            blockedBy: ['atlas-canary'],
            assignees: ['sam', 'priya'],
            reporter: 'admin',
            watchers: ['admin'],
            labels: ['security', 'infrastructure'],
            storyPoints: 13,
            originalEstimate: 2880,
            remainingEstimate: 2400,
            startDate: '2026-08-10',
            dueDate: '2026-09-11',
            comments: [
              {
                author: 'sam',
                content:
                  'Blocked on the canary pipeline. Rotating certs without a staged rollout is how you take down every upstream at once.',
              },
            ],
          },
          {
            key: 'atlas-otel',
            title: 'OpenTelemetry tracing through the request pipeline',
            description:
              'Propagate trace context from edge to upstream response so a slow request can be attributed to a specific hop.',
            type: 'TASK',
            priority: 'MEDIUM',
            status: 'Done',
            sprint: 'sprint-26-6-hardening',
            assignees: ['priya'],
            reporter: 'sam',
            labels: ['observability', 'backend'],
            storyPoints: 8,
            originalEstimate: 1440,
            remainingEstimate: 0,
            startDate: '2026-06-29',
            dueDate: '2026-07-22',
            completedAt: '2026-07-21',
            comments: [
              {
                author: 'priya',
                content:
                  'Sampling at 100% in staging, 5% with tail-based sampling on errors in production. Overhead measured at under 2% p99.',
              },
            ],
            timeEntries: [
              {
                user: 'priya',
                minutes: 480,
                date: '2026-07-01',
                description: 'Instrumented the proxy handler',
              },
              {
                user: 'priya',
                minutes: 420,
                date: '2026-07-15',
                description: 'Collector deployment and sampling config',
              },
            ],
          },
          {
            key: 'atlas-canary',
            title: 'Canary deploy pipeline for gateway config',
            description:
              'Roll config changes to 1% of edge nodes, watch error rate and latency for ten minutes, then promote or roll back automatically.',
            type: 'TASK',
            priority: 'MEDIUM',
            status: 'In Progress',
            sprint: 'sprint-26-7-scale-out',
            assignees: ['sam'],
            reporter: 'priya',
            watchers: ['priya'],
            labels: ['infrastructure', 'observability'],
            storyPoints: 8,
            originalEstimate: 1680,
            remainingEstimate: 900,
            startDate: '2026-07-27',
            dueDate: '2026-08-21',
            timeEntries: [
              {
                user: 'sam',
                minutes: 480,
                date: '2026-07-30',
                description: 'Promotion and rollback controller',
              },
            ],
          },
          {
            key: 'atlas-h2',
            title: 'Header casing lost when proxying HTTP/2 to HTTP/1.1',
            description:
              'HTTP/2 lowercases header names. Two legacy upstreams match on exact casing and reject the request, returning 400.',
            type: 'BUG',
            priority: 'MEDIUM',
            status: 'Backlog',
            sprint: 'sprint-26-8-polish',
            assignees: ['diego'],
            reporter: 'hana',
            labels: ['backend', 'tech-debt'],
            storyPoints: 3,
            originalEstimate: 480,
            remainingEstimate: 480,
            startDate: '2026-08-24',
            dueDate: '2026-09-08',
            comments: [
              {
                author: 'hana',
                content:
                  'Hit this integrating the CLI against the staging gateway. Workaround for now is pinning HTTP/1.1 on those two routes.',
              },
            ],
          },
          {
            key: 'atlas-docs',
            title: 'Document rate-limit tiers in the developer portal',
            description:
              'Publish the per-plan limits, burst allowances, and the backoff behaviour clients are expected to implement.',
            type: 'TASK',
            priority: 'LOWEST',
            status: 'Backlog',
            sprint: 'sprint-26-8-polish',
            blockedBy: ['atlas-headers'],
            assignees: ['hana'],
            reporter: 'priya',
            labels: ['documentation'],
            storyPoints: 2,
            originalEstimate: 360,
            remainingEstimate: 360,
            startDate: '2026-09-01',
            dueDate: '2026-09-18',
          },
        ],
      },
      {
        slug: 'helios-billing-service',
        name: 'Helios Billing Service',
        taskPrefix: 'HELIOS',
        description:
          'Usage metering, invoicing, and payment reconciliation for every metered Northwind product.',
        color: '#F59E0B',
        status: 'ACTIVE',
        priority: 'URGENT',
        visibility: 'PRIVATE',
        startDate: '2026-06-01',
        endDate: '2026-11-27',
        members: [
          { user: 'diego', role: 'OWNER' },
          { user: 'priya', role: 'MEMBER' },
          { user: 'admin', role: 'MANAGER' },
        ],
        tasks: [
          {
            key: 'helios-epic',
            title: 'Usage-based billing general availability',
            description:
              'Move metered billing off the pilot flag and onto every paying account, with invoices that reconcile to the cent.',
            type: 'EPIC',
            priority: 'HIGHEST',
            status: 'In Progress',
            sprint: 'sprint-26-7-scale-out',
            assignees: ['diego'],
            reporter: 'admin',
            watchers: ['admin', 'priya'],
            labels: ['backend'],
            storyPoints: 21,
            originalEstimate: 5760,
            remainingEstimate: 3600,
            startDate: '2026-06-01',
            dueDate: '2026-11-27',
            comments: [
              {
                author: 'admin',
                content:
                  'GA gate is one clean reconciliation cycle with zero manual corrections. Not "few corrections" — zero.',
              },
            ],
          },
          {
            key: 'helios-metering',
            title: 'Metered usage aggregation pipeline',
            description:
              'Aggregate raw usage events into hourly rollups per account and meter, with late-arriving events folded into the correct bucket.',
            type: 'STORY',
            priority: 'HIGH',
            status: 'Done',
            sprint: 'sprint-26-6-hardening',
            parent: 'helios-epic',
            assignees: ['diego'],
            reporter: 'admin',
            labels: ['backend', 'performance'],
            storyPoints: 13,
            originalEstimate: 2400,
            remainingEstimate: 0,
            startDate: '2026-06-29',
            dueDate: '2026-07-24',
            completedAt: '2026-07-23',
            timeEntries: [
              {
                user: 'diego',
                minutes: 480,
                date: '2026-07-01',
                description: 'Hourly rollup job and watermark handling',
              },
              {
                user: 'diego',
                minutes: 420,
                date: '2026-07-09',
                description: 'Late event replay path',
              },
              {
                user: 'diego',
                minutes: 360,
                date: '2026-07-22',
                description: 'Backfill validation against pilot accounts',
              },
            ],
          },
          {
            key: 'helios-webhooks',
            title: 'Stripe webhook idempotency',
            description:
              'Persist the provider event id before processing so a redelivered webhook can never double-apply a payment.',
            type: 'STORY',
            priority: 'HIGH',
            status: 'In Review',
            sprint: 'sprint-26-7-scale-out',
            parent: 'helios-epic',
            assignees: ['diego'],
            reporter: 'priya',
            watchers: ['admin'],
            labels: ['backend', 'security'],
            storyPoints: 8,
            originalEstimate: 1200,
            remainingEstimate: 240,
            startDate: '2026-07-27',
            dueDate: '2026-08-14',
            comments: [
              {
                author: 'priya',
                content:
                  'Unique index on the provider event id, insert before processing, swallow the duplicate-key error. Cheapest correct thing here.',
              },
              {
                author: 'diego',
                content: 'Done that way. Replayed a week of staging events, no double-apply.',
              },
            ],
            timeEntries: [
              {
                user: 'diego',
                minutes: 360,
                date: '2026-07-31',
                description: 'Event ledger table and insert-first handler',
              },
            ],
          },
          {
            key: 'helios-proration',
            title: 'Proration miscalculated on mid-cycle downgrade',
            description:
              'Downgrading mid-cycle credits the full month rather than the unused remainder, so the customer is over-credited.',
            type: 'BUG',
            priority: 'HIGHEST',
            status: 'In Progress',
            sprint: 'sprint-26-7-scale-out',
            assignees: ['diego', 'admin'],
            reporter: 'admin',
            watchers: ['admin', 'priya'],
            labels: ['backend', 'security'],
            storyPoints: 5,
            originalEstimate: 720,
            remainingEstimate: 300,
            startDate: '2026-08-05',
            dueDate: '2026-08-18',
            comments: [
              {
                author: 'admin',
                content:
                  'Money bug. Needs a regression test per billing interval, not a spot fix on the monthly path.',
              },
            ],
            timeEntries: [
              {
                user: 'diego',
                minutes: 240,
                date: '2026-08-06',
                description: 'Isolated the day-count rounding error',
              },
            ],
          },
          {
            key: 'helios-reconcile',
            title: 'Nightly invoice reconciliation job',
            description:
              'Compare issued invoices against provider charges every night and raise a discrepancy report instead of failing silently.',
            type: 'TASK',
            priority: 'MEDIUM',
            status: 'Ready',
            sprint: 'sprint-26-8-polish',
            blockedBy: ['helios-webhooks'],
            assignees: ['diego'],
            reporter: 'admin',
            labels: ['backend', 'observability'],
            storyPoints: 8,
            originalEstimate: 1440,
            remainingEstimate: 1440,
            startDate: '2026-08-24',
            dueDate: '2026-09-18',
          },
          {
            key: 'helios-pci',
            title: 'PCI scope review for the card vault',
            description:
              'Confirm no primary account number reaches Northwind infrastructure and document the boundary for the assessor.',
            type: 'TASK',
            priority: 'HIGH',
            status: 'Blocked',
            sprint: 'sprint-26-7-scale-out',
            assignees: ['admin'],
            reporter: 'admin',
            watchers: ['diego'],
            labels: ['security', 'documentation'],
            storyPoints: 5,
            originalEstimate: 960,
            remainingEstimate: 960,
            startDate: '2026-08-03',
            dueDate: '2026-08-28',
            comments: [
              {
                author: 'admin',
                content:
                  'Waiting on the assessor to confirm which SAQ applies before we write anything up.',
              },
            ],
          },
          {
            key: 'helios-currency',
            title: 'Currency rounding drift in EUR invoices',
            description:
              'Line items round independently before summing, so a multi-line EUR invoice can differ from the charged total by a cent.',
            type: 'BUG',
            priority: 'MEDIUM',
            status: 'Backlog',
            sprint: 'sprint-26-8-polish',
            assignees: ['diego'],
            reporter: 'hana',
            labels: ['backend', 'tech-debt'],
            storyPoints: 3,
            originalEstimate: 480,
            remainingEstimate: 480,
            startDate: '2026-08-31',
            dueDate: '2026-09-15',
          },
          {
            key: 'helios-backfill',
            title: 'Backfill legacy subscriptions into the new schema',
            description:
              'Migrate the remaining pre-Helios subscriptions, keeping the original billing anchor date so nobody is charged twice in one month.',
            type: 'TASK',
            priority: 'LOW',
            status: 'Backlog',
            sprint: 'sprint-26-8-polish',
            blockedBy: ['helios-proration'],
            assignees: ['diego'],
            reporter: 'priya',
            labels: ['backend', 'tech-debt'],
            storyPoints: 5,
            originalEstimate: 1200,
            remainingEstimate: 1200,
            startDate: '2026-09-01',
            dueDate: '2026-09-25',
          },
        ],
      },
    ],
  },
  {
    slug: 'developer-experience',
    name: 'Developer Experience',
    description: 'The tools, docs, and first-run experience developers meet before anything else.',
    color: '#0EA5E9',
    members: [
      { user: 'admin', role: 'OWNER' },
      { user: 'hana', role: 'MANAGER' },
      { user: 'priya', role: 'MEMBER' },
    ],
    projects: [
      {
        slug: 'forge-cli',
        name: 'Forge CLI',
        taskPrefix: 'FORGE',
        description:
          'Command-line tool for scaffolding, running, and deploying services against the Northwind platform.',
        color: '#10B981',
        status: 'PLANNING',
        priority: 'MEDIUM',
        visibility: 'PUBLIC',
        startDate: '2026-08-03',
        endDate: '2027-02-26',
        members: [
          { user: 'hana', role: 'OWNER' },
          { user: 'priya', role: 'MEMBER' },
          { user: 'admin', role: 'MANAGER' },
        ],
        tasks: [
          {
            key: 'forge-epic',
            title: 'Forge CLI 1.0',
            description:
              'A stable, documented 1.0 with a versioned plugin API and a install-to-first-deploy path under five minutes.',
            type: 'EPIC',
            priority: 'HIGH',
            status: 'In Progress',
            sprint: 'sprint-26-7-scale-out',
            assignees: ['hana'],
            reporter: 'admin',
            watchers: ['admin', 'priya'],
            labels: ['frontend', 'documentation'],
            storyPoints: 21,
            originalEstimate: 4320,
            remainingEstimate: 3600,
            startDate: '2026-08-03',
            dueDate: '2027-01-29',
          },
          {
            key: 'forge-plugins',
            title: 'Plugin system with signed manifests',
            description:
              'Load third-party plugins from a manifest, verifying the publisher signature before any plugin code is executed.',
            type: 'STORY',
            priority: 'HIGH',
            status: 'In Progress',
            sprint: 'sprint-26-7-scale-out',
            parent: 'forge-epic',
            assignees: ['hana', 'priya'],
            reporter: 'admin',
            watchers: ['admin'],
            labels: ['security', 'backend'],
            storyPoints: 13,
            originalEstimate: 2400,
            remainingEstimate: 1680,
            startDate: '2026-08-03',
            dueDate: '2026-09-11',
            comments: [
              {
                author: 'admin',
                content:
                  'Signature verification happens before load, not after. An unsigned plugin should never get as far as being imported.',
              },
              {
                author: 'hana',
                content:
                  'That is the design. Verify manifest, then resolve the entry point, then import.',
              },
            ],
            timeEntries: [
              {
                user: 'hana',
                minutes: 420,
                date: '2026-08-05',
                description: 'Manifest schema and signature verification',
              },
              {
                user: 'priya',
                minutes: 300,
                date: '2026-08-11',
                description: 'Plugin resolution and load order',
              },
            ],
          },
          {
            key: 'forge-init-bug',
            title: 'forge init overwrites an existing config without prompting',
            description:
              'Running forge init in a directory that already has forge.toml silently replaces it, losing local configuration.',
            type: 'BUG',
            priority: 'HIGHEST',
            status: 'In Review',
            sprint: 'sprint-26-7-scale-out',
            assignees: ['hana'],
            reporter: 'sam',
            watchers: ['admin', 'sam'],
            labels: ['frontend'],
            storyPoints: 3,
            originalEstimate: 300,
            remainingEstimate: 60,
            startDate: '2026-08-10',
            dueDate: '2026-08-17',
            comments: [
              {
                author: 'sam',
                content:
                  'Lost twenty minutes of config to this. Prompt, or refuse and require --force.',
              },
              {
                author: 'hana',
                content: 'Refusing with --force to override. A prompt is the wrong default in CI.',
              },
            ],
            timeEntries: [
              {
                user: 'hana',
                minutes: 180,
                date: '2026-08-11',
                description: 'Guard plus --force flag and tests',
              },
            ],
          },
          {
            key: 'forge-completions',
            title: 'Shell completions for bash, zsh, and fish',
            description:
              'Generate completion scripts from the command tree so they cannot drift from the actual commands.',
            type: 'TASK',
            priority: 'LOW',
            status: 'Ready',
            sprint: 'sprint-26-8-polish',
            assignees: ['hana'],
            reporter: 'hana',
            labels: ['frontend', 'documentation'],
            storyPoints: 3,
            originalEstimate: 480,
            remainingEstimate: 480,
            startDate: '2026-08-24',
            dueDate: '2026-09-04',
          },
          {
            key: 'forge-cache',
            title: 'Offline template cache',
            description:
              'Cache scaffolding templates locally so forge new works on a plane, falling back to the cache when the registry is unreachable.',
            type: 'TASK',
            priority: 'MEDIUM',
            status: 'Backlog',
            sprint: 'sprint-26-8-polish',
            blockedBy: ['forge-plugins'],
            assignees: ['priya'],
            reporter: 'hana',
            labels: ['performance', 'frontend'],
            storyPoints: 5,
            originalEstimate: 720,
            remainingEstimate: 720,
            startDate: '2026-09-07',
            dueDate: '2026-09-18',
          },
          {
            key: 'forge-install',
            title: 'Publish the install script and Homebrew tap',
            description:
              'One-line install on Linux and macOS, with checksums published alongside every release artifact.',
            type: 'TASK',
            priority: 'LOWEST',
            status: 'Backlog',
            sprint: 'sprint-26-8-polish',
            assignees: ['sam'],
            reporter: 'hana',
            labels: ['infrastructure', 'documentation'],
            storyPoints: 3,
            originalEstimate: 480,
            remainingEstimate: 480,
            startDate: '2026-09-07',
            dueDate: '2026-09-18',
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Seeding Northwind Labs demo data...\n');

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Users -------------------------------------------------------------
  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const profile = {
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      status: 'ACTIVE' as const,
      emailVerified: true,
      bio: u.bio,
      timezone: u.timezone,
      language: 'en',
      preferences: {
        theme: 'system',
        notifications: { email: true, push: true, desktop: true },
        dashboard: { showCompletedTasks: false, defaultView: 'list' },
      },
    };
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: profile,
      create: { id: uid(`user:${u.email}`), email: u.email, password, ...profile },
    });
    userIds[u.key] = user.id;
    console.log(`   ✓ user ${u.email}`);
  }

  // --- Organization ------------------------------------------------------
  const ownerId = userIds.admin;
  const org = await prisma.organization.upsert({
    where: { slug: ORGANIZATION.slug },
    update: {
      name: ORGANIZATION.name,
      description: ORGANIZATION.description,
      website: ORGANIZATION.website,
      ownerId,
      updatedBy: ownerId,
    },
    create: {
      id: uid(`org:${ORGANIZATION.slug}`),
      ...ORGANIZATION,
      ownerId,
      createdBy: ownerId,
      updatedBy: ownerId,
      settings: { defaultTaskView: 'list', weekStartsOn: 1, allowPublicProjects: true },
    },
  });
  console.log(`   ✓ organization ${org.name}`);

  for (const u of USERS) {
    await prisma.organizationMember.upsert({
      where: { userId_organizationId: { userId: userIds[u.key], organizationId: org.id } },
      update: { role: u.orgRole },
      create: {
        id: uid(`orgmember:${u.email}`),
        userId: userIds[u.key],
        organizationId: org.id,
        role: u.orgRole,
        isDefault: true,
        createdBy: ownerId,
      },
    });
    await prisma.user.update({
      where: { id: userIds[u.key] },
      data: { defaultOrganizationId: org.id },
    });
  }
  console.log(`   ✓ ${USERS.length} organization members`);

  // --- Workflow ----------------------------------------------------------
  // Workflow has no natural unique key, so key it on the deterministic id.
  const workflow = await prisma.workflow.upsert({
    where: { id: uid(`workflow:${org.slug}:${WORKFLOW.name}`) },
    update: { name: WORKFLOW.name, description: WORKFLOW.description, updatedBy: ownerId },
    create: {
      id: uid(`workflow:${org.slug}:${WORKFLOW.name}`),
      name: WORKFLOW.name,
      description: WORKFLOW.description,
      isDefault: true,
      organizationId: org.id,
      createdBy: ownerId,
      updatedBy: ownerId,
    },
  });

  const statusIds: Record<string, string> = {};
  for (const [i, s] of WORKFLOW.statuses.entries()) {
    const status = await prisma.taskStatus.upsert({
      where: { workflowId_name: { workflowId: workflow.id, name: s.name } },
      update: { color: s.color, category: s.category, position: i + 1, updatedBy: ownerId },
      create: {
        id: uid(`status:${workflow.id}:${s.name}`),
        name: s.name,
        color: s.color,
        category: s.category,
        position: i + 1,
        isDefault: s.isDefault ?? false,
        workflowId: workflow.id,
        createdBy: ownerId,
        updatedBy: ownerId,
      },
    });
    statusIds[s.name] = status.id;
  }

  for (const [from, to, name] of WORKFLOW.transitions) {
    await prisma.statusTransition.upsert({
      where: {
        workflowId_fromStatusId_toStatusId: {
          workflowId: workflow.id,
          fromStatusId: statusIds[from],
          toStatusId: statusIds[to],
        },
      },
      update: { name },
      create: {
        id: uid(`transition:${workflow.id}:${from}->${to}`),
        name,
        workflowId: workflow.id,
        fromStatusId: statusIds[from],
        toStatusId: statusIds[to],
        createdBy: ownerId,
      },
    });
  }
  console.log(
    `   ✓ workflow ${workflow.name} (${WORKFLOW.statuses.length} statuses, ${WORKFLOW.transitions.length} transitions)`,
  );

  // --- Workspaces, projects, tasks ---------------------------------------
  let taskTotal = 0;

  for (const ws of WORKSPACES) {
    const workspace = await prisma.workspace.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: ws.slug } },
      update: { name: ws.name, description: ws.description, color: ws.color, updatedBy: ownerId },
      create: {
        id: uid(`workspace:${ws.slug}`),
        name: ws.name,
        slug: ws.slug,
        description: ws.description,
        color: ws.color,
        organizationId: org.id,
        createdBy: ownerId,
        updatedBy: ownerId,
      },
    });

    for (const m of ws.members) {
      await prisma.workspaceMember.upsert({
        where: { userId_workspaceId: { userId: userIds[m.user], workspaceId: workspace.id } },
        update: { role: m.role },
        create: {
          id: uid(`wsmember:${ws.slug}:${m.user}`),
          userId: userIds[m.user],
          workspaceId: workspace.id,
          role: m.role,
          createdBy: ownerId,
        },
      });
    }
    console.log(`   ✓ workspace ${workspace.name} (${ws.members.length} members)`);

    for (const p of ws.projects) {
      const project = await prisma.project.upsert({
        where: { slug: p.slug },
        update: {
          name: p.name,
          description: p.description,
          taskPrefix: p.taskPrefix,
          color: p.color,
          status: p.status,
          priority: p.priority,
          visibility: p.visibility,
          startDate: d(p.startDate),
          endDate: d(p.endDate),
          workspaceId: workspace.id,
          workflowId: workflow.id,
          updatedBy: ownerId,
        },
        create: {
          id: uid(`project:${p.slug}`),
          name: p.name,
          slug: p.slug,
          taskPrefix: p.taskPrefix,
          description: p.description,
          color: p.color,
          status: p.status,
          priority: p.priority,
          visibility: p.visibility,
          startDate: d(p.startDate),
          endDate: d(p.endDate),
          workspaceId: workspace.id,
          workflowId: workflow.id,
          createdBy: ownerId,
          updatedBy: ownerId,
          settings: { taskNumbering: 'sequential', defaultAssignee: null },
        },
      });

      for (const m of p.members) {
        await prisma.projectMember.upsert({
          where: { userId_projectId: { userId: userIds[m.user], projectId: project.id } },
          update: { role: m.role },
          create: {
            id: uid(`projmember:${p.slug}:${m.user}`),
            userId: userIds[m.user],
            projectId: project.id,
            role: m.role,
            createdBy: ownerId,
          },
        });
      }

      const labelIds: Record<string, string> = {};
      for (const l of LABELS) {
        const label = await prisma.label.upsert({
          where: { projectId_name: { projectId: project.id, name: l.name } },
          update: { color: l.color, description: l.description, updatedBy: ownerId },
          create: {
            id: uid(`label:${p.slug}:${l.name}`),
            name: l.name,
            color: l.color,
            description: l.description,
            projectId: project.id,
            createdBy: ownerId,
            updatedBy: ownerId,
          },
        });
        labelIds[l.name] = label.id;
        // Surface the label at workspace level too, so workspace views see it.
        await prisma.workspaceLabel.upsert({
          where: { workspaceId_labelId: { workspaceId: workspace.id, labelId: label.id } },
          update: {},
          create: { workspaceId: workspace.id, labelId: label.id },
        });
      }

      const sprintIds: Record<string, string> = {};
      for (const s of SPRINTS) {
        const sprint = await prisma.sprint.upsert({
          where: { projectId_slug: { projectId: project.id, slug: s.slug } },
          update: {
            name: s.name,
            goal: s.goal,
            status: s.status,
            startDate: d(s.startDate),
            endDate: d(s.endDate),
            updatedBy: ownerId,
          },
          create: {
            id: uid(`sprint:${p.slug}:${s.slug}`),
            name: s.name,
            slug: s.slug,
            goal: s.goal,
            status: s.status,
            isDefault: s.isDefault ?? false,
            startDate: d(s.startDate),
            endDate: d(s.endDate),
            projectId: project.id,
            createdBy: ownerId,
            updatedBy: ownerId,
          },
        });
        sprintIds[s.slug] = sprint.id;
      }

      // Tasks. Parents always appear before their children in the array, so a
      // single forward pass resolves parentTaskId without a second sweep.
      const taskIds: Record<string, string> = {};
      for (const [i, t] of p.tasks.entries()) {
        const taskNumber = i + 1;
        const authorId = userIds[t.reporter];
        const base = {
          title: t.title,
          description: t.description,
          type: t.type,
          priority: t.priority,
          slug: `${p.slug}-${taskNumber}`,
          startDate: d(t.startDate),
          dueDate: d(t.dueDate),
          completedAt: t.completedAt ? d(t.completedAt) : null,
          storyPoints: t.storyPoints ?? null,
          originalEstimate: t.originalEstimate ?? null,
          remainingEstimate: t.remainingEstimate ?? null,
          statusId: statusIds[t.status],
          sprintId: sprintIds[t.sprint],
          parentTaskId: t.parent ? taskIds[t.parent] : null,
          updatedBy: authorId,
        };
        const task = await prisma.task.upsert({
          where: { projectId_taskNumber: { projectId: project.id, taskNumber } },
          update: base,
          create: {
            id: uid(`task:${t.key}`),
            taskNumber,
            projectId: project.id,
            createdBy: authorId,
            ...base,
          },
        });
        taskIds[t.key] = task.id;
        taskTotal++;

        for (const a of t.assignees) {
          await prisma.taskAssignee.upsert({
            where: { taskId_userId: { taskId: task.id, userId: userIds[a] } },
            update: {},
            create: { taskId: task.id, userId: userIds[a] },
          });
        }

        await prisma.taskReporter.upsert({
          where: { taskId_userId: { taskId: task.id, userId: authorId } },
          update: {},
          create: { taskId: task.id, userId: authorId },
        });

        for (const w of t.watchers ?? []) {
          await prisma.taskWatcher.upsert({
            where: { taskId_userId: { taskId: task.id, userId: userIds[w] } },
            update: {},
            create: {
              id: uid(`watcher:${t.key}:${w}`),
              taskId: task.id,
              userId: userIds[w],
              createdBy: authorId,
            },
          });
        }

        for (const l of t.labels) {
          await prisma.taskLabel.upsert({
            where: { taskId_labelId: { taskId: task.id, labelId: labelIds[l] } },
            update: {},
            create: { taskId: task.id, labelId: labelIds[l], createdBy: authorId },
          });
        }

        for (const [ci, c] of (t.comments ?? []).entries()) {
          const id = uid(`comment:${t.key}:${ci}`);
          await prisma.taskComment.upsert({
            where: { id },
            update: { content: c.content },
            create: {
              id,
              content: c.content,
              taskId: task.id,
              authorId: userIds[c.author],
              createdBy: userIds[c.author],
            },
          });
        }

        for (const [ei, e] of (t.timeEntries ?? []).entries()) {
          const id = uid(`time:${t.key}:${ei}`);
          await prisma.timeEntry.upsert({
            where: { id },
            update: { timeSpent: e.minutes, description: e.description, date: d(e.date) },
            create: {
              id,
              description: e.description,
              timeSpent: e.minutes,
              date: d(e.date),
              taskId: task.id,
              userId: userIds[e.user],
              createdBy: userIds[e.user],
            },
          });
        }

        // One rank row per view, so list/board/gantt have a stable order.
        for (const viewType of ['LIST', 'BOARD', 'GANTT'] as const) {
          await prisma.taskRank.upsert({
            where: {
              taskId_scopeType_scopeId_viewType: {
                taskId: task.id,
                scopeType: 'PROJECT',
                scopeId: project.id,
                viewType,
              },
            },
            update: { rank: taskNumber * 1000 },
            create: {
              id: uid(`rank:${t.key}:${viewType}`),
              taskId: task.id,
              scopeType: 'PROJECT',
              scopeId: project.id,
              viewType,
              rank: taskNumber * 1000,
            },
          });
        }
      }

      // Dependencies last — both sides of every edge now exist.
      let depCount = 0;
      for (const t of p.tasks) {
        for (const blocker of t.blockedBy ?? []) {
          await prisma.taskDependency.upsert({
            where: {
              dependentTaskId_blockingTaskId: {
                dependentTaskId: taskIds[t.key],
                blockingTaskId: taskIds[blocker],
              },
            },
            update: {},
            create: {
              id: uid(`dep:${t.key}<-${blocker}`),
              type: 'BLOCKS',
              dependentTaskId: taskIds[t.key],
              blockingTaskId: taskIds[blocker],
              createdBy: ownerId,
            },
          });
          depCount++;
        }
      }

      console.log(
        `   ✓ project ${project.name} — ${p.tasks.length} tasks, ${SPRINTS.length} sprints, ${LABELS.length} labels, ${depCount} dependencies`,
      );
    }
  }

  console.log(
    `\n🎉 Done. ${USERS.length} users, 1 organization, ${WORKSPACES.length} workspaces, ` +
      `${WORKSPACES.reduce((n, w) => n + w.projects.length, 0)} projects, ${taskTotal} tasks.`,
  );
  console.log(`   Sign in as admin@taskosaur.com / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('\n❌ Demo seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
