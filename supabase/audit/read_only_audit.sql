-- Campusly READ-ONLY audit. Safe to run in the Supabase SQL Editor.
-- It only SELECTs from catalog tables. It changes nothing.
-- Paste the full result table back to the developer.

select 'migration' as area, '0001 core tables' as item,
  ((to_regclass('public.colleges') is not null) and (to_regclass('public.profiles') is not null)
   and (to_regclass('public.student_verifications') is not null))::text as detail
union all select 'migration', '0002 signup trigger',
  exists(select 1 from pg_trigger where tgname = 'on_auth_user_created_campusly' and not tgisinternal)::text
union all select 'migration', '0002 signup function', (to_regprocedure('public.handle_new_campusly_user()') is not null)::text
union all select 'migration', '0003 is_verified NOT writable by authenticated',
  (not exists(select 1 from information_schema.column_privileges where table_schema='public' and table_name='profiles'
     and grantee='authenticated' and privilege_type='UPDATE' and column_name in ('is_verified','role','id')))::text
union all select 'migration', '0003 bio writable by authenticated',
  exists(select 1 from information_schema.column_privileges where table_schema='public' and table_name='profiles'
     and grantee='authenticated' and privilege_type='UPDATE' and column_name='bio')::text
union all select 'migration', '0004 social tables',
  ((to_regclass('public.posts') is not null) and (to_regclass('public.post_likes') is not null)
   and (to_regclass('public.post_comments') is not null) and (to_regclass('public.saved_posts') is not null)
   and (to_regclass('public.stories') is not null))::text
union all select 'migration', '0005 audit table', (to_regclass('public.student_verification_audit') is not null)::text
union all select 'migration', '0005 review function',
  (to_regprocedure('public.admin_review_student_verification(uuid,uuid,text,text)') is not null)::text
union all select 'migration', '0006 is_verified_student()', (to_regprocedure('public.is_verified_student()') is not null)::text
union all select 'migration', '0007 can_view_author()', (to_regprocedure('public.can_view_author(uuid)') is not null)::text
union all select 'migration', '0006 profile read policy present',
  exists(select 1 from pg_policies where schemaname='public' and tablename='profiles'
     and policyname='Users read own profile or verified students'' profiles')::text
union all select 'migration', '0007 posts policy present',
  exists(select 1 from pg_policies where schemaname='public' and tablename='posts'
     and policyname='Verified students read posts from their college')::text

union all select 'table', c.relname,
  case when c.relrowsecurity then 'RLS enabled' else 'RLS DISABLED' end
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'

union all select 'policy', tablename || ' :: ' || policyname,
  cmd || ' to ' || array_to_string(roles, ',') || ' | using: ' || coalesce(qual, '-') || ' | check: ' || coalesce(with_check, '-')
from pg_policies where schemaname in ('public', 'storage')

union all select 'grant', table_name || ' -> ' || grantee,
  string_agg(privilege_type, ', ' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by table_name, grantee

union all select 'function', p.oid::regprocedure::text,
  'security definer=' || p.prosecdef::text
  || ' | execute anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
  || ' | execute authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'

union all select 'trigger', t.tgname || ' on ' || t.tgrelid::regclass::text, 'enabled'
from pg_trigger t where not t.tgisinternal and t.tgrelid in ('auth.users'::regclass, 'public.profiles'::regclass)

union all select 'storage bucket', id,
  'public=' || public::text || ' | size limit=' || coalesce(file_size_limit::text, 'none')
  || ' | mime=' || coalesce(array_to_string(allowed_mime_types, ','), 'any')
from storage.buckets

union all select 'storage policy', policyname, cmd || ' to ' || array_to_string(roles, ',')
  || ' | ' || coalesce(qual, '') || ' | ' || coalesce(with_check, '')
from pg_policies where schemaname = 'storage'

union all select 'row count', 'auth.users', (select count(*)::text from auth.users)
union all select 'row count', 'profiles', (select count(*)::text from public.profiles)
union all select 'row count', 'student_verifications pending',
  (select count(*)::text from public.student_verifications where status = 'pending')
union all select 'row count', 'student_verification_audit', (select count(*)::text from public.student_verification_audit);
