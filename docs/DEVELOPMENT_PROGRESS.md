# Campusly — Development progress

Legend: ✅ Complete and tested · [~] Implemented but needs testing · ⬜ Not started · [!] Blocked

Last updated: 25 November 2026 · Branch: `feat/admin-verification`

## Milestone 1 — Audit and foundation hardening (this session)

| Item | Status before | Changes | Files | Migrations | Tests | Result |
|---|---|---|---|---|---|---|
| Repository audit | — | Read all pages, lib, API route, 6 migrations, CI | `docs/FEATURE_AUDIT.md` | — | Manual review | Done |
| Baseline typecheck & build | — | Installed deps; baseline typecheck and build passed before any change | — | — | `npm run typecheck`, `npm run build` | ✅ |
| Database test harness | ⬜ | Supabase stub + helpers that act as `authenticated`, `anon` and admin RPC | `supabase/tests/00_supabase_stub.sql`, `tests/db/setup.mjs`, `tests/db/README.md` | — | — | ✅ harness runs |
| RLS and privilege tests | ⬜ | 26 tests: student escalation, verification self-approval, document privacy, admin RPC privilege, audit privacy, verified vs unverified social access, profile visibility | `tests/db/rls.test.mjs` | — | `npm run test:db` | ✅ 26/26 |
| Profile visibility fix | [~] (found privacy gap) | Restricted profile reads to self, or verified viewer reading verified profile | `supabase/migrations/0006_profile_visibility_hardening.sql` | 0006 | RLS tests | ✅ |
| Production server smoke test | ⬜ | Checked `/admin/verifications` redirect, admin API 401 for GET and POST | — | — | `next start` + curl | ✅ (no real login) |
| CI | [~] typecheck + build only | Added Postgres 16 service job running `npm run test:db`; `npm ci`; placeholder public env for build | `.github/workflows/ci.yml` | — | Pending GitHub run | [~] |
| Docs | Outdated | Added `FEATURE_AUDIT.md`, this file; corrected README and overview | `docs/*`, `README.md` | — | — | ✅ |

## Milestone 2 — Security and campus scoping (this session)

| Item | Result |
|---|---|
| Migration 0007: posts, likes, comments, stories visible only within the viewer's college | ✅ 30/30 DB tests |
| Server middleware redirects logged-out users from protected routes | ✅ live HTTP 307 checks; [~] not tested with a real session |
| Login honours `?next=` (same-site paths only) | ✅ build; [~] not browser-tested |
| Admin POST rejects cross-site Origin | ✅ live HTTP 403 check |

## Feature milestones

| Feature | Status | Notes |
|---|---|---|
| Authentication (signup, login, logout, reset) | [~] | Code exists; never tested against Supabase Auth |
| Email confirmation | [!] | Needs Supabase Auth Site URL, redirect allow-list and SMTP |
| Student profile edit | ✅ (DB level) | UI not browser-tested |
| Profile photo / cover / public profile page | ⬜ | |
| Verification submission, pending status | [~] | DB enforced and tested |
| Admin review (approve / reject / audit) | [~] | DB tested; end-to-end not run |
| Campus feed (text, image, like, comment, save) | [~] | College-scoped at DB level (0007) | DB tested for like/comment/post; UI not browser-tested |
| Reply to comments, edit/delete UI, pagination, share page | ⬜ | |
| Stories (video, viewer, reactions) | ⬜ | Image stories present, not tested |
| Explore / search / suggestions | ⬜ | |
| Friends and blocking (Part 5) | ⬜ | |
| Messaging (Part 6) | ⬜ | |
| Communities (Part 7) | ⬜ | Tables only |
| Events (Part 8) | ⬜ | Table only |
| Marketplace (Part 9) | ⬜ | Nav link points to a missing route |
| Notifications (Part 10) | ⬜ | |
| Admin: moderation, reports, suspension, colleges, audit viewer (Part 11) | ⬜ | |
| Campus-scoped feed | ✅ (DB) | Migration 0007 |
| Server-side route protection (middleware) | [~] | `middleware.ts`, live-checked |
| Legal review of privacy and terms | [!] | Requires a human lawyer |

## Manual action required before testing or launch
1. Apply migrations 0001–0006 in order to a **non-production** Supabase project, and confirm the migration history.
2. Set Supabase Auth Site URL and redirect allow-list (`/verify`, `/reset-password`, local and Vercel preview URLs).
3. Configure SMTP for auth email, or confirm the default limits are acceptable for testing.
4. Set Vercel Preview variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `ADMIN_EMAILS`. Redeploy after changing them.
5. Create one admin account and one test student account, and confirm each has a profile row.
6. Review `npm audit` findings (1 moderate, 1 high reported at install).
7. Get legal review of the privacy and terms pages before any real student is onboarded.
