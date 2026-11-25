-- Profile visibility: previously every signed-in user (including unverified accounts) could read
-- every profile row. Now a user can always read their own profile, and only verified students
-- can read other verified students' profiles.

create or replace function public.is_verified_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_verified = true
  );
$$;

revoke all on function public.is_verified_student() from public, anon;
grant execute on function public.is_verified_student() to authenticated, service_role;

drop policy if exists "Authenticated users can read basic profiles" on public.profiles;
create policy "Users read own profile or verified students' profiles"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or (is_verified = true and public.is_verified_student())
);
