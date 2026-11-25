Database tests. Run against a disposable Postgres, never a Supabase production project.
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/campusly_test npm run test:db
The stub in supabase/tests/00_supabase_stub.sql reproduces only the auth/storage/role pieces the migrations depend on.
