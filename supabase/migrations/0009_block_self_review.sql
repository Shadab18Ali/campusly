-- An administrator must not review their own verification request.
-- Re-creates the review function with an added check. Grants on the function are kept.

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
  if v_user_id = p_reviewer_id then
    raise exception 'Administrators cannot review their own verification request';
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
