-- Secure admin review audit trail. Admin identity is checked by the Next.js server
-- against ADMIN_EMAILS; the service-role key is never sent to the browser.
create table if not exists public.student_verification_audit (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.student_verifications(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  previous_status text not null,
  new_status text not null check (new_status in ('approved','rejected')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.student_verification_audit enable row level security;
revoke all on public.student_verification_audit from anon, authenticated;
grant all on public.student_verification_audit to service_role;

create or replace function public.admin_review_student_verification(
  p_verification_id uuid,
  p_reviewer_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_previous_status text;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid review status';
  end if;
  if p_status = 'rejected' and nullif(trim(p_reason), '') is null then
    raise exception 'A rejection reason is required';
  end if;

  if not exists (select 1 from public.profiles where id = p_reviewer_id) then
    raise exception 'Admin profile is missing. Create the admin account profile before reviewing.';
  end if;

  select user_id, status
    into v_user_id, v_previous_status
    from public.student_verifications
    where id = p_verification_id
    for update;

  if v_user_id is null then
    raise exception 'Verification request not found';
  end if;
  if v_previous_status <> 'pending' then
    raise exception 'This request has already been reviewed';
  end if;

  update public.student_verifications
    set status = p_status,
        reviewer_id = p_reviewer_id,
        review_reason = nullif(trim(p_reason), ''),
        reviewed_at = now()
    where id = p_verification_id;

  update public.profiles
    set is_verified = (p_status = 'approved'),
        updated_at = now()
    where id = v_user_id;

  insert into public.student_verification_audit
    (verification_id, student_id, reviewer_id, previous_status, new_status, reason)
  values
    (p_verification_id, v_user_id, p_reviewer_id, v_previous_status, p_status, nullif(trim(p_reason), ''));
end;
$$;

revoke all on function public.admin_review_student_verification(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_student_verification(uuid, uuid, text, text) to service_role;
