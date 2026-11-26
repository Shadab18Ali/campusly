-- Friends and blocking.
-- Friend requests are pending until the addressee accepts. Declining or cancelling deletes the row.
-- Blocking hides each user's content from the other, prevents new requests, and removes any friendship.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);
-- One row per pair of users, in either direction.
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships(addressee_id, status);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

-- True when either user has blocked the other. Security definer so policies can use it safely.
create or replace function public.is_blocked_either(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;
revoke all on function public.is_blocked_either(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_either(uuid, uuid) to authenticated, service_role;

-- Blocking removes any existing friendship between the two users.
create or replace function public.remove_friendship_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
     or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return new;
end;
$$;
drop trigger if exists user_blocks_remove_friendship on public.user_blocks;
create trigger user_blocks_remove_friendship after insert on public.user_blocks
for each row execute function public.remove_friendship_on_block();

-- Table privileges. New tables get Supabase's default grants, so set them explicitly.
revoke all on public.friendships from anon, authenticated;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant all on public.friendships, public.user_blocks to service_role;

alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;

drop policy if exists "Members read their friendships" on public.friendships;
create policy "Members read their friendships" on public.friendships for select to authenticated
using (auth.uid() in (requester_id, addressee_id) and public.is_verified_student());

drop policy if exists "Verified students send requests" on public.friendships;
create policy "Verified students send requests" on public.friendships for insert to authenticated
with check (
  requester_id = auth.uid()
  and status = 'pending'
  and responded_at is null
  and public.is_verified_student()
  and not public.is_blocked_either(requester_id, addressee_id)
  and exists (select 1 from public.profiles p where p.id = addressee_id and p.is_verified = true)
);

drop policy if exists "Addressee accepts requests" on public.friendships;
create policy "Addressee accepts requests" on public.friendships for update to authenticated
using (addressee_id = auth.uid() and status = 'pending')
with check (addressee_id = auth.uid() and status = 'accepted' and responded_at is not null);

drop policy if exists "Members remove friendships" on public.friendships;
create policy "Members remove friendships" on public.friendships for delete to authenticated
using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "Users read own blocks" on public.user_blocks;
create policy "Users read own blocks" on public.user_blocks for select to authenticated
using (blocker_id = auth.uid());

drop policy if exists "Users block others" on public.user_blocks;
create policy "Users block others" on public.user_blocks for insert to authenticated
with check (blocker_id = auth.uid());

drop policy if exists "Users unblock" on public.user_blocks;
create policy "Users unblock" on public.user_blocks for delete to authenticated
using (blocker_id = auth.uid());

-- Blocked users' posts are hidden in both directions (extends the college rule from migration 0007).
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
      )
  );
$$;
