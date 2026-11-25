-- Campus scoping: verified students see posts, likes, comments and stories only from
-- verified students at their own college. Own content stays visible to its author.

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
      and (
        (author.id = viewer.id)
        or (author.is_verified = true
            and viewer.college_id is not null
            and author.college_id = viewer.college_id)
      )
  );
$$;
revoke all on function public.can_view_author(uuid) from public, anon;
grant execute on function public.can_view_author(uuid) to authenticated, service_role;

drop policy if exists "Verified students read campus posts" on public.posts;
create policy "Verified students read posts from their college" on public.posts for select to authenticated
using (public.can_view_author(user_id));

drop policy if exists "Verified students read likes" on public.post_likes;
create policy "Verified students read likes on visible posts" on public.post_likes for select to authenticated
using (exists (select 1 from public.posts po where po.id = post_id));
drop policy if exists "Verified students like" on public.post_likes;
create policy "Verified students like visible posts" on public.post_likes for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.posts po where po.id = post_id));

drop policy if exists "Verified students read comments" on public.post_comments;
create policy "Verified students read comments on visible posts" on public.post_comments for select to authenticated
using (exists (select 1 from public.posts po where po.id = post_id));
drop policy if exists "Verified students comment" on public.post_comments;
create policy "Verified students comment on visible posts" on public.post_comments for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.posts po where po.id = post_id));

drop policy if exists "Verified students read active stories" on public.stories;
create policy "Verified students read campus stories" on public.stories for select to authenticated
using (expires_at > now() and public.can_view_author(user_id));
