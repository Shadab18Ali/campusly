# Campusly
Your campus. Your people. Your space.

Campusly is an India-first, student-focused campus social network. Students sign up, confirm their email and submit an official college document for administrator review. Approved students can join a campus feed and, over time, connect with classmates, communities, clubs and events.

**Read the canonical product brief and build status:** [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)

## Stack
Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth, PostgreSQL with RLS, private Supabase Storage and Vercel.

## Local setup
1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Run migrations 0001–0005 in numerical order in the Supabase SQL Editor, after checking which have already been applied.
5. Configure Supabase Auth Site URL and redirect allowlist for local and deployed confirmation/reset routes.
6. Run `npm run dev`.

## Current state
- **Implemented foundation:** landing page, authentication, email confirmation, password recovery, profile, dashboard and student document submission.
- **Implemented social foundation:** database/UI starting points for posts, likes, comments, saved posts and stories; needs end-to-end RLS and account testing.
- **Implemented on development branch:** admin verification review page and server-side API with an email allowlist, short-lived private document URLs and audit trail.
- **Not yet built:** friend requests, direct messaging, mature college communities, full events/marketplace, notifications and moderation suite.
- **Not launch-ready yet:** migrations, Vercel environment variables, admin permissions, document retention and privacy/legal review must be verified.

## Admin review setup
The admin page is at `/admin/verifications`. Configure server-only `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_EMAILS` in Vercel for Preview/Production, run migration 0005, then redeploy. Never expose the service-role key in browser code or commit it.

## Development workflow
Work on `feat/admin-verification` and use [PR #2](https://github.com/Shadab18Ali/campusly/pull/2) for review. Check [GitHub Actions](https://github.com/Shadab18Ali/campusly/actions) and the latest Vercel Preview before considering a change complete. Do not merge to `main` or promote to Production without review.

Privacy and Terms pages are drafts and require legal review. See the product overview for security, testing and launch requirements.
