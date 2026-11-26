-- Notifications for friend requests, friend acceptances, likes, comments and replies.
-- Rows are created by database triggers only. Recipients can read their own and mark them read.
-- No notification is created when the actor is the recipient, or when either user has blocked the other.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_accepted', 'post_like', 'post_comment', 'comment_reply')),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_not_self check (actor_id <> recipient_id)
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

-- Creates one notification unless the actor is the recipient or a block exists.
create or replace function public.create_notification(
  p_recipient uuid, p_actor uuid, p_kind text, p_post uuid, p_comment uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recipient is null or p_recipient = p_actor then return; end if;
  if public.is_blocked_either(p_recipient, p_actor) then return; end if;
  insert into public.notifications(recipient_id, actor_id, kind, post_id, comment_id)
  values (p_recipient, p_actor, p_kind, p_post, p_comment);
end;
$$;

create or replace function public.notify_friendship()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.create_notification(new.addressee_id, new.requester_id, 'friend_request', null, null);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.create_notification(new.requester_id, new.addressee_id, 'friend_accepted', null, null);
  end if;
  return new;
end;
$$;
drop trigger if exists friendships_notify on public.friendships;
create trigger friendships_notify after insert or update on public.friendships
for each row execute function public.notify_friendship();

create or replace function public.notify_post_like()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_author uuid;
begin
  select user_id into v_author from public.posts where id = new.post_id;
  perform public.create_notification(v_author, new.user_id, 'post_like', new.post_id, null);
  return new;
end;
$$;
drop trigger if exists post_likes_notify on public.post_likes;
create trigger post_likes_notify after insert on public.post_likes
for each row execute function public.notify_post_like();

create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_author uuid; v_parent_author uuid;
begin
  if new.parent_id is null then
    select user_id into v_author from public.posts where id = new.post_id;
    perform public.create_notification(v_author, new.user_id, 'post_comment', new.post_id, new.id);
  else
    select user_id into v_parent_author from public.post_comments where id = new.parent_id;
    perform public.create_notification(v_parent_author, new.user_id, 'comment_reply', new.post_id, new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists post_comments_notify on public.post_comments;
create trigger post_comments_notify after insert on public.post_comments
for each row execute function public.notify_comment();

-- Privileges and row-level security
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

drop policy if exists "Recipients read own notifications" on public.notifications;
create policy "Recipients read own notifications" on public.notifications for select to authenticated
using (recipient_id = auth.uid());

drop policy if exists "Recipients mark own notifications read" on public.notifications;
create policy "Recipients mark own notifications read" on public.notifications for update to authenticated
using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
