 # Campusly
Your campus. Your people. Your space.

## Stack
Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth, PostgreSQL and private Supabase Storage.

## Local setup
1. Install Node.js 20.9 or newer.
2. Run npm install.
3. Copy .env.example to .env.local and set the Supabase URL and anon key.
4. Run supabase/migrations/0001_campusly_phase1.sql in the Supabase SQL editor.
5. Run npm run dev.

## Phase 1 foundation
Responsive landing page, Supabase email/password signup and login, verification upload UI, starter college/profile/verification schema and dashboard shell.

## Before launch
Admin authorization, audit logging, profile bootstrap, hardened permissions and policy tests are still required. GPS is not wired in and must never be treated as identity proof. Social feed, friends, messaging, communities, events and marketplace are later phases. Never commit .env.local or expose service-role credentials.