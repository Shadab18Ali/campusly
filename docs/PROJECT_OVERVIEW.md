# Campusly — Product overview and build status

Last updated: 25 November 2026

## 1. What we are building

Campusly is a student-focused social network for college and university students, starting with an India-first audience. The goal is to give students one campus-centered place to meet classmates, share everyday moments, discover activities, find communities and eventually communicate with one another.

The product should feel youthful and familiar to Gen Z, but it must not sacrifice privacy or safety. It is not intended to be an unrestricted public social network: access to the student community is gated by a student-verification process.

### Core user journey

1. A student creates an account with their name, email, college/university and course details.
2. The student confirms their email.
3. The student submits a current official student document, such as a college ID card or current fee receipt.
4. An authorized Campusly administrator reviews the submission.
5. Once approved, the student's account is marked verified and the student can access the verified campus network.
6. Verified students can create posts, react, comment, save posts and share short-lived stories.
7. Later releases add friend connections, direct messages, college communities, clubs, events and other campus tools.

A college name entered at signup is a claim, not proof of enrollment. Only an authorized review decision can grant verified status. GPS/location is not identity proof.

## 2. Product principles

- **Student-only community:** verification is required before access to the social network.
- **Private identity documents:** verification files stay in a private storage bucket and must never appear on public profiles or public URLs.
- **Least privilege:** privileged actions happen server-side; ordinary users cannot grant themselves admin or verified status.
- **Campus relevance:** prioritize content and people connected to a student's college.
- **Gen Z experience:** responsive, visual, simple, fast and welcoming.
- **Build in safe stages:** test authentication, database policies and admin review before inviting real students.

## 3. Technology

- Next.js App Router and React
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL with Row Level Security (RLS)
- Supabase Storage for private student documents and campus media
- Vercel for hosting and preview deployments
- GitHub for source control and CI

## 4. Implemented in the repository

The following is present in the `feat/admin-verification` development branch. Presence in GitHub does not by itself mean every feature has been production-tested or is live on the production domain.

### Application and account foundation
- Campusly landing page and responsive visual foundation.
- Email/password signup and login.
- Signup collects name, email, college, department, course and graduation year.
- Email confirmation and password recovery/reset pages.
- Automatic profile creation from signup metadata through a database trigger.
- Dashboard with the student's profile/verification state.
- Profile editing for permitted public profile fields.
- Starter Privacy and Terms pages; these are drafts and require legal review.

### Student verification
- Student document submission page.
- Supports JPG, PNG and PDF, with a 5 MB limit.
- Private `student-verification` Supabase Storage bucket.
- Submission record stored with pending status.
- Student can see their own verification status.
- Students cannot directly set their own approved status through the intended RLS model.

### Social feature foundation
- Database migration for posts, likes, comments, saved posts, stories, campus events and clubs.
- Dashboard UI includes the initial feed experience and interactions for posts, likes, comments, saved posts and stories.
- Campus media uses a separate private storage bucket with authenticated/verified-user policies.
- Verified-student access is enforced in the social tables' RLS policies.

These social capabilities are an MVP foundation. They still need end-to-end testing with verified and unverified accounts, especially around college scoping, media access and policy edge cases.

### Admin verification review
- Admin verification page at `/admin/verifications`.
- Server-side admin email allowlist using `ADMIN_EMAILS`.
- Server-only Supabase service-role client.
- Pending request list with student/profile details.
- Short-lived signed document preview URLs (10 minutes).
- Approve/reject actions; rejection requires a reason.
- Database function updates verification status and student verified flag.
- Audit table records reviewer, decision, prior status, reason and timestamp.
- Audit table is not readable by ordinary authenticated users.

The admin workflow requires migration 0005 and correct server environment variables before it can work. It has not yet been declared production-ready.

## 5. Database migrations

Apply migrations in numerical order in the intended Supabase project:

1. `0001_campusly_phase1.sql` — colleges, profiles, student verification, initial RLS and private verification storage.
2. `0002_profile_bootstrap.sql` — creates a profile and college association on auth signup.
3. `0003_profile_edit_permissions.sql` — limits editable profile columns and tightens verification submission checks.
4. `0004_campus_social.sql` — social tables, RLS and campus media storage.
5. `0005_admin_verification_review.sql` — verification audit table and privileged review function.

Do not assume these migrations have run in every Supabase environment. Check the target project's migration history before applying them, and test on a non-production project first.

## 6. Current deployment and repository workflow

- GitHub repository: https://github.com/Shadab18Ali/campusly
- Current development branch: `feat/admin-verification`
- Admin implementation pull request: https://github.com/Shadab18Ali/campusly/pull/2
- CI workflow: https://github.com/Shadab18Ali/campusly/actions
- Vercel is connected to the repository and produces branch preview deployments.
- Keep new work on the development branch and use pull requests for review. Do not merge to `main` or change production deployment settings without an explicit decision.

A previous feature commit on this branch passed GitHub CI. The latest documentation-only commit should still be checked for its own final status. Vercel preview builds have had earlier TypeScript/build failures during development; always inspect the newest deployment rather than relying on an older green deployment.

## 7. Configuration required

Browser-safe variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the publishable key expected by the current Supabase client configuration)

Server-only variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS` — comma-separated exact email addresses permitted to access admin review.

Never prefix a service-role/secret key with `NEXT_PUBLIC_`. Never commit secrets to GitHub or paste them into chat. Configure the correct values separately for Preview and Production in Vercel. Redeploy after changing environment variables.

Supabase Auth must have the correct Site URL and redirect allowlist for local and deployed callback routes, including email confirmation and password reset.

## 8. Not built yet / future roadmap

These are planned, not completed features:

1. Friend/follow requests and connection lists.
2. One-to-one and group direct messaging, with safe authorization and reporting.
3. College-specific communities, course groups and club membership.
4. Campus events: creation, RSVP and event discovery.
5. Explore/search with college-aware discovery.
6. Marketplace with listings, moderation and safety controls.
7. Notifications and activity inbox.
8. Reporting, blocking, content moderation and admin tools beyond document review.
9. Student document retention/deletion workflows and privacy request handling.
10. Product analytics, rate limiting, abuse prevention, backups and operational monitoring.

Do not present these roadmap items as already available.

## 9. Immediate next steps

1. Confirm migrations 0001–0005 have been applied to the intended Supabase project, in order.
2. Configure and verify Vercel environment variables for Preview.
3. Confirm the admin account exists in Supabase Auth and has a matching profile row; add its exact email to `ADMIN_EMAILS`.
4. Deploy the development branch to Preview and test admin access.
5. Test the complete student journey using separate student and admin accounts:
   - signup and email confirmation;
   - document upload and pending status;
   - student cannot view another student's document or approve themselves;
   - non-admin receives no admin data;
   - admin can preview, approve and reject;
   - approval grants verified access; rejection does not;
   - audit record is created;
   - unverified student cannot read/create social content;
   - verified student can create/read permitted campus content.
6. Fix any failing build, CI or policy test before merging.
7. Only after security and user-flow testing, decide whether to merge and promote to production.

## 10. Launch and privacy cautions

- Use test documents and test accounts during development. Do not use real student ID documents until access controls, retention, deletion and incident response are reviewed.
- The service-role key bypasses RLS; keep its use limited to trusted server code.
- Signed document URLs are temporary, but anyone who receives a live URL may access it until expiry. Do not log or share these URLs.
- The current admin allowlist is an email-based gate. Protect admin email accounts with strong authentication and consider stronger admin controls before scaling.
- Review database/storage policies with automated tests; code comments and UI messages are not security guarantees.
- Privacy and Terms pages are starter drafts, not legal advice or approved legal documents. Get appropriate legal review before public launch.
- Set a clear minimum age/eligibility policy and document retention period before onboarding real users.
