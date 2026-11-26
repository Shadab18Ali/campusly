-- Comment replies: a comment may reply to another comment on the same post.
-- Deleting a parent comment deletes its replies.

alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;

create index if not exists post_comments_parent_idx on public.post_comments(parent_id);

-- Looks up the post of a comment without applying row-level security to the lookup.
-- (A policy that queries its own table would recurse.)
create or replace function public.comment_post_id(p_comment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select post_id from public.post_comments where id = p_comment_id;
$$;
revoke all on function public.comment_post_id(uuid) from public, anon;
grant execute on function public.comment_post_id(uuid) to authenticated, service_role;

drop policy if exists "Verified students comment on visible posts" on public.post_comments;
create policy "Verified students comment on visible posts" on public.post_comments for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.posts po where po.id = post_id)
  and (parent_id is null or public.comment_post_id(parent_id) = post_id)
);
