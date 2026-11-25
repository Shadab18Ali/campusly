-- Campusly social foundation: posts, stories, reactions, comments, bookmarks and campus notices.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 2200),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_content_or_image check (char_length(trim(content)) > 0 or image_path is not null)
);
create index if not exists posts_created_idx on public.posts(created_at desc);
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments(post_id,created_at);
create table if not exists public.saved_posts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null,
  caption text check(char_length(caption)<=120),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists stories_expiry_idx on public.stories(expires_at desc);
create table if not exists public.campus_events (
  id uuid primary key default gen_random_uuid(),
  college_id uuid references public.colleges(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  venue text,
  created_at timestamptz not null default now()
);
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  college_id uuid references public.colleges(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.saved_posts enable row level security;
alter table public.stories enable row level security;
alter table public.campus_events enable row level security;
alter table public.clubs enable row level security;

drop policy if exists "Verified students read campus posts" on public.posts;
create policy "Verified students read campus posts" on public.posts for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Verified students create own posts" on public.posts;
create policy "Verified students create own posts" on public.posts for insert to authenticated
with check(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Authors update own posts" on public.posts;
create policy "Authors update own posts" on public.posts for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "Authors delete own posts" on public.posts;
create policy "Authors delete own posts" on public.posts for delete to authenticated using(user_id=auth.uid());

drop policy if exists "Verified students read likes" on public.post_likes;
create policy "Verified students read likes" on public.post_likes for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Verified students like" on public.post_likes;
create policy "Verified students like" on public.post_likes for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Students unlike own likes" on public.post_likes;
create policy "Students unlike own likes" on public.post_likes for delete to authenticated using(user_id=auth.uid());

drop policy if exists "Verified students read comments" on public.post_comments;
create policy "Verified students read comments" on public.post_comments for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Verified students comment" on public.post_comments;
create policy "Verified students comment" on public.post_comments for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Students delete own comments" on public.post_comments;
create policy "Students delete own comments" on public.post_comments for delete to authenticated using(user_id=auth.uid());

drop policy if exists "Students read own saved posts" on public.saved_posts;
create policy "Students read own saved posts" on public.saved_posts for select to authenticated using(user_id=auth.uid());
drop policy if exists "Students save posts" on public.saved_posts;
create policy "Students save posts" on public.saved_posts for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Students unsave posts" on public.saved_posts;
create policy "Students unsave posts" on public.saved_posts for delete to authenticated using(user_id=auth.uid());

drop policy if exists "Verified students read active stories" on public.stories;
create policy "Verified students read active stories" on public.stories for select to authenticated using(expires_at>now() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Verified students create own stories" on public.stories;
create policy "Verified students create own stories" on public.stories for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Students delete own stories" on public.stories;
create policy "Students delete own stories" on public.stories for delete to authenticated using(user_id=auth.uid());

drop policy if exists "Verified students read campus events" on public.campus_events;
create policy "Verified students read campus events" on public.campus_events for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true and (college_id is null or college_id=p.college_id)));
drop policy if exists "Verified students read clubs" on public.clubs;
create policy "Verified students read clubs" on public.clubs for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true and (college_id is null or college_id=p.college_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('campus-media','campus-media',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists "Verified students upload campus media" on storage.objects;
create policy "Verified students upload campus media" on storage.objects for insert to authenticated
with check(bucket_id='campus-media' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Verified students read campus media" on storage.objects;
create policy "Verified students read campus media" on storage.objects for select to authenticated
using(bucket_id='campus-media' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_verified=true));
drop policy if exists "Students delete own campus media" on storage.objects;
create policy "Students delete own campus media" on storage.objects for delete to authenticated
using(bucket_id='campus-media' and (storage.foldername(name))[1]=auth.uid()::text);
