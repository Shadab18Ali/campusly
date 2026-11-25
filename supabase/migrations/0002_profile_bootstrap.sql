create or replace function public.handle_new_campusly_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_college_id uuid;
  v_college_name text;
begin
  v_college_name := nullif(trim(new.raw_user_meta_data ->> 'college_name'), '');
  if v_college_name is not null then
    select id into v_college_id from public.colleges where lower(name) = lower(v_college_name) limit 1;
    if v_college_id is null then
      insert into public.colleges(name) values (v_college_name) returning id into v_college_id;
    end if;
  end if;
  insert into public.profiles(id, full_name, college_id, department, course, graduation_year, role, is_verified)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Campusly student'),
    v_college_id,
    nullif(trim(new.raw_user_meta_data ->> 'department'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'course'), ''),
    case when (new.raw_user_meta_data ->> 'graduation_year') ~ '^20[0-9]{2}$' then (new.raw_user_meta_data ->> 'graduation_year')::integer else null end,
    'student',
    false
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_campusly on auth.users;
create trigger on_auth_user_created_campusly
after insert on auth.users
for each row execute function public.handle_new_campusly_user();

-- This trigger is SECURITY DEFINER so students cannot choose privileged profile fields.
-- Keep the function owned by a trusted database role and review it before production.