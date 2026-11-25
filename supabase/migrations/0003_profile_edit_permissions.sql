-- Allow students to edit only their public profile fields.
-- Privileged fields (role, is_verified, id) remain server-controlled.
revoke update on public.profiles from authenticated;
grant update (full_name, department, course, graduation_year, bio) on public.profiles to authenticated;

drop policy if exists "Students update their own profile" on public.profiles;
create policy "Students update their own profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role = 'student');

create or replace function public.set_profile_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_profile_updated_at();

drop policy if exists "Students submit own verification" on public.student_verifications;
create policy "Students submit own verification"
on public.student_verifications for insert to authenticated
with check (
  auth.uid() = user_id
  and status = 'pending'
  and reviewer_id is null
  and reviewed_at is null
  and split_part(document_path, '/', 1) = auth.uid()::text
);
