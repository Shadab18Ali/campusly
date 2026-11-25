# Campusly — Feature audit

Audit date: 25 November 2026 · Branch audited: `feat/admin-verification` (HEAD `276c290`)

## Status key
- **COMPLETE AND VERIFIED** — implemented and functionally tested.
- **IMPLEMENTED BUT NOT VERIFIED** — code exists, not tested.
- **PARTIALLY IMPLEMENTED** — some parts exist, important parts missing.
- **NOT IMPLEMENTED** — does not exist.
- **BLOCKED** — needs external configuration, credentials or a decision.

"Verified" below means one of: a Postgres test in `tests/db/rls.test.mjs` (run against Postgres 16 with the migrations applied), a production build, or a live HTTP check of the running production server. Nothing was tested against a real Supabase project, a real email inbox, a real browser session or Vercel.

## Test environment used
- Local Postgres 16 with a Supabase stub (`supabase/tests/00_supabase_stub.sql`) and migrations 0001–0006 applied in order.
- `npm run typecheck`, `npm run build`, `npm run test:db` (26 tests), `next start` smoke checks.

## Feature status

| # | Feature | Status | Relevant files | DB dependencies | Tests performed | Errors found | Work remaining |
|---|---|---|---|---|---|---|---|
| 1 | Landing page & design system | IMPLEMENTED BUT NOT VERIFIED | `app/page.tsx`, `app/globals.css`, `tailwind.config.ts` | — | Build; HTTP 200 | None | Visual QA on mobile/tablet/desktop |
| 2 | Signup (name, email, college, dept, course, year) | IMPLEMENTED BUT NOT VERIFIED | `app/signup/page.tsx` | `auth.users` → trigger | Trigger tested for profile creation (DB) | Signup UI never executed against Supabase Auth | Live signup test on a non-prod project |
| 3 | Profile auto-creation on signup | COMPLETE AND VERIFIED (DB level) | `supabase/migrations/0002_profile_bootstrap.sql` | `profiles`, `colleges` | DB test: profile created with role=student, is_verified=false | — | Confirm migration history on the real project |
| 4 | Email confirmation | BLOCKED | `app/signup/page.tsx`, `app/verify/page.tsx` | Supabase Auth settings | None | Redirect `/verify` must be allow-listed; SMTP unknown | Configure Site URL, redirect allow-list and SMTP in Supabase |
| 5 | Login / logout | IMPLEMENTED BUT NOT VERIFIED | `app/login/page.tsx`, `app/dashboard/page.tsx` (logout) | Supabase Auth | HTTP 200 | No server-side session middleware; logout is client-side | Live test |
| 6 | Password recovery & reset | IMPLEMENTED BUT NOT VERIFIED | `app/forgot-password/page.tsx`, `app/reset-password/page.tsx` | Supabase Auth | HTTP 200 | Relies on Auth allow-list | Configure and test the reset email flow |
| 7 | Protected routes | IMPLEMENTED BUT NOT VERIFIED | `middleware.ts`, `app/login/page.tsx` (honours `?next=`) | RLS | Live HTTP: /dashboard, /profile, /verify, /admin/* return 307 to /login when logged out | Middleware session check not tested with a real signed-in cookie | Test with a real Supabase session |
| 8 | Student profile edit (name, dept, course, year, bio) | COMPLETE AND VERIFIED (DB level) | `app/profile/page.tsx`, `0003_profile_edit_permissions.sql` | `profiles` column grants | DB tests: student can edit permitted fields; cannot set `is_verified` or `role`; cannot edit another profile | UI save flow not executed in browser | Browser test |
| 9 | Profile photo, cover photo | NOT IMPLEMENTED | — | would need `avatar_path` / cover columns (only `avatar_path` exists) | — | — | Build upload + display |
| 10 | Public student profile page (others' view) | NOT IMPLEMENTED | — | — | — | — | Build `/students/[id]` |
| 11 | Verification document upload | IMPLEMENTED BUT NOT VERIFIED (DB enforced) | `app/verify/page.tsx`, `0001`, `0003` | `student_verifications`, bucket `student-verification` | DB tests: own-folder upload only; cannot insert into another folder; cannot insert `approved`; cannot read others' rows or documents; anon has no access | Client-side validation only (type and size); the bucket limit (5 MB) and MIME list enforce server-side | Live upload test; magic-byte validation is not done |
| 12 | Pending verification status | COMPLETE AND VERIFIED (DB level) | `app/dashboard/page.tsx`, `app/verify/page.tsx` | `student_verifications` | DB test: student reads own row only | — | UI state for rejected / resubmission not built |
| 13 | Student cannot self-approve | COMPLETE AND VERIFIED | `0001` (no UPDATE policy), `0003` | `student_verifications`, `profiles` | DB tests: self-approval blocked, `is_verified` update denied | — | — |
| 14 | Admin access control | COMPLETE AND VERIFIED (server side) | `lib/supabase/admin-auth.ts`, `app/admin/verifications/page.tsx`, `app/api/admin/verifications/route.ts` | — | HTTP: admin page redirects, API returns 401 unauthenticated. Allowlist check is by email (`ADMIN_EMAILS`) | Admin **authorized-path** test not run (needs a real Supabase session) | Live admin login test; move to role-based admin (see Security) |
| 15 | Admin review list, preview, approve/reject | IMPLEMENTED BUT NOT VERIFIED | `app/admin/verifications/ui.tsx`, `route.ts` | service role, `admin_review_student_verification` | DB tests cover the RPC: approve, reject, missing reason, double review | UI and API path not run end to end | Live test with admin and student accounts |
| 16 | Rejection reason | COMPLETE AND VERIFIED (DB level) | `0005` | `student_verifications.review_reason` | DB test: reason is required and stored | — | Show reason to student in UI |
| 17 | Verification audit history | COMPLETE AND VERIFIED (DB level) | `0005` | `student_verification_audit` | DB tests: audit row written; table not readable by authenticated or anon | No admin UI to view history | Audit history view |
| 18 | Student status updated after decision | COMPLETE AND VERIFIED (DB level) | `0005` | `profiles.is_verified` | DB tests: approval grants verified, rejection does not | — | — |
| 19 | Campus feed: create text posts | COMPLETE AND VERIFIED (DB) / IMPLEMENTED (UI) | `app/dashboard/page.tsx`, `0004` | `posts` | DB tests: verified insert; unverified insert denied; cannot post as another user | UI not run in browser | Browser test |
| 20 | Campus feed: image posts | IMPLEMENTED BUT NOT VERIFIED | `app/dashboard/page.tsx`, `0004` | `campus-media` bucket | Bucket policies exist | Storage policies not exercised; no upload-to-own-folder test | Add storage tests with real Storage API |
| 21 | Like / unlike | COMPLETE AND VERIFIED (DB) | `0004` | `post_likes` | DB tests: verified like allowed; unverified denied | — | — |
| 22 | Comment; reply to comment | PARTIALLY IMPLEMENTED | `0004` | `post_comments` (no `parent_id`) | Comment insert verified (DB) | **Replies are not implemented** (no parent column) | Add `parent_id` and reply UI |
| 23 | Edit / delete own posts | PARTIALLY IMPLEMENTED | `0004` | `posts` | DB: other users cannot delete | Edit is allowed by RLS but has **no UI**; delete has no UI | Add edit/delete UI |
| 24 | Save / unsave posts | IMPLEMENTED BUT NOT VERIFIED | `dashboard/page.tsx`, `0004` | `saved_posts` | DB policies present | UI not run | Browser test |
| 25 | Share posts | PARTIALLY IMPLEMENTED | `dashboard/page.tsx` | — | — | Shares the page URL; no per-post route | Per-post route |
| 26 | Paginated / infinite feed | NOT IMPLEMENTED | `dashboard/page.tsx` | `posts` | — | Fixed `limit(30)`, no pagination | Cursor pagination |
| 27 | Stories: image | IMPLEMENTED BUT NOT VERIFIED | `dashboard/page.tsx`, `0004` | `stories`, `campus-media` | Expiry filter in policy | Upload validation is client-side | Live test |
| 28 | Stories: video, viewer, reactions | NOT IMPLEMENTED | — | — | — | Only image upload; opens the image in a new tab | Build viewer, video and reactions |
| 29 | Stories 24-hour expiry | COMPLETE AND VERIFIED (policy) | `0004` | `stories.expires_at` | Policy checked by DB design | Expired rows are still stored; no cleanup job | Scheduled deletion job |
| 30 | Comments and likes count | IMPLEMENTED BUT NOT VERIFIED | `dashboard/page.tsx` | — | — | Fetches full comment rows just to count | Use count aggregate |
| 31 | Explore / search students & colleges | NOT IMPLEMENTED | `dashboard/page.tsx` nav has a non-functional "Explore" and search button | — | — | — | Build search |
| 32 | Popular posts / suggested students | NOT IMPLEMENTED | — | — | — | — | — |
| 33 | Followers / friends / requests | NOT IMPLEMENTED | — | — | — | — | Friend system (Part 5) |
| 34 | Direct messaging | NOT IMPLEMENTED | — | — | — | — | Messaging (Part 6) |
| 35 | Communities, clubs | NOT IMPLEMENTED | `campus_events`, `clubs` tables exist; the dashboard shows placeholder text | `clubs`, `campus_events` | — | Tables only, no UI or membership | Part 7 |
| 36 | Events (create, RSVP, reminders) | NOT IMPLEMENTED | table `campus_events` only | — | — | No create/RSVP policy | Part 8 |
| 37 | Marketplace | NOT IMPLEMENTED | `/marketplace` is linked in the nav but **the route does not exist** (404) | — | — | Broken link | Part 9 |
| 38 | Notifications | NOT IMPLEMENTED | — | — | — | — | Part 10 |
| 39 | Blocking users | NOT IMPLEMENTED | — | — | — | — | Part 5 |
| 40 | Reporting content | NOT IMPLEMENTED | — | — | — | — | Part 11 |
| 41 | Admin: user management, post moderation, suspension, college management, audit viewer | NOT IMPLEMENTED | — | — | — | Only verification review exists | Part 11 |
| 42 | Legal pages (privacy, terms) | IMPLEMENTED BUT NOT VERIFIED — **requires legal review** | `app/privacy/page.tsx`, `app/terms/page.tsx` | — | HTTP 200 | Starter drafts, not legal advice | Legal review before launch |
| 43 | Profile visibility (who can read profiles) | COMPLETE AND VERIFIED (fixed in 0006) | `0006_profile_visibility_hardening.sql` | `profiles` | DB tests: unverified sees only self; verified sees verified peers only | Was previously readable by all authenticated users (privacy bug, fixed) | — |
| 44 | Campus-scoped feed | COMPLETE AND VERIFIED (DB level) | `0007_college_scoped_visibility.sql` | `posts`, `profiles.college_id` | DB tests: other-college student cannot read, like or comment; same-college student can; no-college student sees nothing from others | Students with no college see only their own posts | Live feed test |

## Security findings

| Severity | Finding | Status |
|---|---|---|
| High (fixed) | Any signed-in user, including unverified accounts, could read every profile row. | Fixed in migration 0006, with DB tests. |
| High (fixed) | Verified students across all colleges could read each other's posts. | Fixed in migration 0007, with DB tests. |
| Medium (fixed) | Student pages were guarded only in the browser. | `middleware.ts` redirects logged-out requests (live-tested). |
| Medium (fixed) | Admin POST had no cross-site check. | Same-origin check returns 403 (live-tested). |
| Medium | Admin access is gated by a single email allowlist. There is no role table, no MFA requirement and no rate limit on the admin API. | Open; design decision needed. |
| Low | No uniqueness on pending verifications, so a student can submit many. | Open. |
| Low | Client-side file checks only in the browser. Server enforces bucket size and MIME type. Magic-byte validation is missing. | Open. |
| Low | Story and post media is kept in a bucket whose read policy lets any verified student read any file path. Paths are unguessable UUIDs, but this is not a hard guarantee. | Open. |
| Info | Migration 0002 lets any signup create a new `colleges` row from free text. | Open; consider a curated list. |
| Info | `NEXT_PUBLIC_*` variables contain only the URL and anon key. The service-role key is used only in `lib/supabase/admin.ts`, which imports `server-only`. | Verified by code reading. |

## Documentation corrections made in this audit
- README now lists the test command and migration 0006.
- `docs/PROJECT_OVERVIEW.md` previously said the admin workflow was complete and that posts were campus-scoped. Both statements are corrected.
