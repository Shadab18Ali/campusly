-- Friends can see each other's posts, stories and reactions, even at different colleges.
-- Blocking still overrides this (checked in can_view_author). Non-friends keep the same-college rule.

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b) or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;
revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated, service_role;

create or replace function public.can_view_author(p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles viewer
    join public.profiles author on author.id = p_author
    where viewer.id = auth.uid()
      and viewer.is_verified = true
      and not public.is_blocked_either(viewer.id, author.id)
      and (
        (author.id = viewer.id)
        or (author.is_verified = true
            and viewer.college_id is not null
            and author.college_id = viewer.college_id)
        or (author.is_verified = true
            and public.are_friends(viewer.id, author.id))
      )
  );
$$;
