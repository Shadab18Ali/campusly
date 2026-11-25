# Campusly
Your campus. Your people. Your space.

## Stack
Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth, PostgreSQL and private Supabase Storage.

## Local setup
1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Run the SQL migrations in `supabase/migrations/` in numeric order in the Supabase SQL editor.
5. In Supabase Auth, configure the site URL and allow the local and deployed callback URLs, including `/verify` and `/reset-password`.
6. Run `npm run dev`.

## Implemented foundation
- Responsive Campusly landing page and design system.
- Supabase email/password signup, login, password recovery and password reset.
- Student document submission interface (private bucket; JPG, PNG, PDF; 5 MB limit).
- Dashboard with verification status.
- College, profile and verification database schema.
- Automatic student profile creation on signup.
- Profile edit permissions restricted to ordinary profile fields.
- Starter privacy and terms pages (drafts requiring legal review).

## Before real student onboarding
- Apply and test all migrations in order on a non-production Supabase project first.
- Configure Supabase Auth email templates, redirect allow-list and SMTP deliverability.
- Add a trusted admin authorization model, admin review screen/API, audit log and short-lived signed document access.
- Review and test RLS and Storage policies with separate student and administrator accounts.
- Define document retention/deletion, privacy contact, age/eligibility policy and incident response.
- Do not treat GPS as identity proof. Location should be optional and transparently permissioned.
- The privacy and terms pages are starter drafts, not legal advice or launch-ready legal agreements.

Social feed, friendships, messaging, communities, events and marketplace are subsequent milestones. Never commit `.env.local` or expose the Supabase service-role key.
