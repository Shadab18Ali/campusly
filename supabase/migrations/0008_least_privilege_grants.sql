-- Least-privilege table grants. Supabase's default grants give anon and authenticated
-- TRUNCATE/REFERENCES/TRIGGER on every public table, and the social tables were missing the
-- SELECT/INSERT/UPDATE/DELETE grants their RLS policies need. This migration makes the grants
-- explicit. RLS policies still decide which rows are visible or writable.

-- 1. Remove everything, then grant back only what the app uses.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon;

-- Anonymous visitors have no table access in Campusly.
-- Signed-in users get only the table privileges below; RLS limits the rows.
grant select on public.colleges to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, department, course, graduation_year, bio)
  on public.profiles to authenticated;

grant select, insert on public.student_verifications to authenticated;

grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, delete on public.post_comments to authenticated;
grant select, insert, delete on public.saved_posts to authenticated;
grant select, insert, delete on public.stories to authenticated;
grant select on public.campus_events to authenticated;
grant select on public.clubs to authenticated;
-- student_verification_audit: intentionally no grant. Admin access goes through the review function.

-- 2. Trigger functions and the admin function must not be callable directly by app roles.
revoke all on function public.handle_new_campusly_user() from public, anon, authenticated;
revoke all on function public.set_profile_updated_at() from public, anon, authenticated;

-- 3. Campus events and clubs: fix the policy that compared p.college_id with itself.
drop policy if exists "Verified students read campus events" on public.campus_events;
create policy "Verified students read campus events" on public.campus_events for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.is_verified = true
    and (campus_events.college_id is null or campus_events.college_id = p.college_id)
));

drop policy if exists "Verified students read clubs" on public.clubs;
create policy "Verified students read clubs" on public.clubs for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.is_verified = true
    and (clubs.college_id is null or clubs.college_id = p.college_id)
));
