-- The server uses the service_role key for the admin API and for the verification review.
-- Some Supabase projects do not grant table access to service_role by default, which made the
-- admin list fail with "permission denied" (SQLSTATE 42501). This restores that access.
-- Row-level security does not apply to service_role; these grants only let the server work.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
