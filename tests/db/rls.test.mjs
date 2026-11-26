// Database security tests. Run with: DATABASE_URL=postgres://... npm run test:db
// Each test runs as a real Postgres role (authenticated / anon / service_role) so RLS and grants are enforced.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildDatabase, connect, createUser, asUser, asAnon, fails } from "./setup.mjs";

let db;
let student, unverified, verified, otherVerified, admin;
let pendingVerificationId, otherVerificationId, postId;

before(async () => {
  await buildDatabase();
  db = await connect();
  unverified = await createUser(db, { name: "Unverified" });
  student = await createUser(db, { name: "Pending Student", college: "Campus A" });
  verified = await createUser(db, { name: "Verified A", college: "Campus A", verified: true });
  otherVerified = await createUser(db, { name: "Verified B", college: "Campus B", verified: true });
  admin = await createUser(db, { name: "Admin", admin: true, email: "admin@example.edu" });

  // Each student submits a document in their own folder (as that student).
  const sub = (uid, path) => asUser(db, uid, (c) => c.query(
    "insert into public.student_verifications(user_id, document_path, document_type, status) values ($1,$2,'college_id','pending') returning id",
    [uid, path]), { commit: true });
  pendingVerificationId = (await sub(student, `${student}/doc-1.pdf`)).rows[0].id;
  otherVerificationId = (await sub(otherVerified, `${otherVerified}/doc-2.pdf`)).rows[0].id;
  await db.query("insert into storage.objects(bucket_id,name,owner) values ('student-verification',$1,$2),('student-verification',$3,$4)",
    [`${student}/doc-1.pdf`, student, `${otherVerified}/doc-2.pdf`, otherVerified]);
});

after(async () => { if (db) await db.end(); });

// ---------- Profiles: students cannot escalate ----------
test("student cannot set own is_verified", async () => {
  const err = await asUser(db, student, (c) => fails(c, "update public.profiles set is_verified = true where id = $1", [student]));
  assert.ok(err, "expected permission denied");
  assert.match(err, /permission denied/);
});

test("student cannot set own role to admin", async () => {
  const err = await asUser(db, student, (c) => fails(c, "update public.profiles set role = 'admin' where id = $1", [student]));
  assert.match(err, /permission denied/);
});

test("student cannot change another user's profile name", async () => {
  const rows = await asUser(db, student, async (c) => {
    const r = await c.query("update public.profiles set full_name = 'hacked' where id = $1 returning id", [otherVerified]);
    return r.rowCount;
  });
  assert.equal(rows, 0);
});

test("student can edit permitted profile fields", async () => {
  const rows = await asUser(db, student, async (c) => {
    const r = await c.query("update public.profiles set bio = 'hello', course = 'MCA' where id = $1 returning id", [student]);
    return r.rowCount;
  });
  assert.equal(rows, 1);
});

test("signup trigger creates profile as non-admin, unverified", async () => {
  const { rows } = await db.query("select role, is_verified from public.profiles where id = $1", [unverified]);
  assert.equal(rows[0].role, "student");
  assert.equal(rows[0].is_verified, false);
});

// ---------- Verification workflow ----------
test("student cannot self-approve their verification", async () => {
  const err = await asUser(db, student, (c) => fails(c,
    "update public.student_verifications set status = 'approved' where id = $1", [pendingVerificationId]));
  // UPDATE is not granted to students (migration 0008) so the statement is refused. Confirm nothing changed.
  assert.match(err ?? "", /permission denied/);
  const { rows } = await db.query("select status from public.student_verifications where id = $1", [pendingVerificationId]);
  assert.equal(rows[0].status, "pending");
});

test("student cannot insert a verification already approved", async () => {
  const err = await asUser(db, unverified, (c) => fails(c,
    "insert into public.student_verifications(user_id,document_path,document_type,status) values ($1,$2,'college_id','approved')",
    [unverified, `${unverified}/x.pdf`]));
  assert.ok(err, "expected RLS violation");
});

test("student cannot upload a verification document into another user's folder", async () => {
  const err = await asUser(db, unverified, (c) => fails(c,
    "insert into public.student_verifications(user_id,document_path,document_type,status) values ($1,$2,'college_id','pending')",
    [unverified, `${student}/fake.pdf`]));
  assert.ok(err, "expected RLS violation");
});

test("student cannot read another student's verification row", async () => {
  const rows = await asUser(db, student, async (c) => (await c.query("select id from public.student_verifications")).rows);
  assert.deepEqual(rows.map((r) => r.id), [pendingVerificationId]);
});

test("student cannot read another student's document from storage", async () => {
  const rows = await asUser(db, verified, async (c) => (await c.query(
    "select name from storage.objects where bucket_id='student-verification'")).rows);
  assert.equal(rows.length, 0, "verified peers must not see documents");
});

test("student can read own document path only", async () => {
  const rows = await asUser(db, student, async (c) => (await c.query(
    "select name from storage.objects where bucket_id='student-verification'")).rows);
  assert.deepEqual(rows.map((r) => r.name), [`${student}/doc-1.pdf`]);
});

test("anon has no table access at all", async () => {
  const err = await asAnon(db, (c) => fails(c, "select id from public.student_verifications"));
  assert.match(err ?? "", /permission denied/);
});

// ---------- Admin-only operations ----------
test("authenticated user cannot read verification audit table", async () => {
  const err = await asUser(db, admin, (c) => fails(c, "select * from public.student_verification_audit"));
  assert.match(err ?? "", /permission denied/);
});

test("authenticated user cannot execute admin review function directly", async () => {
  const err = await asUser(db, student, (c) => fails(c,
    "select public.admin_review_student_verification($1,$2,'approved',null)", [pendingVerificationId, student]));
  assert.match(err ?? "", /permission denied/);
});

test("anon cannot execute admin review function", async () => {
  const err = await asAnon(db, (c) => fails(c,
    "select public.admin_review_student_verification($1,$2,'approved',null)", [pendingVerificationId, admin]));
  assert.match(err ?? "", /permission denied/);
});

test("rejection without a reason is refused by the database", async () => {
  await db.query("begin");
  try {
    await db.query("select public.admin_review_student_verification($1,$2,'rejected',' ')", [pendingVerificationId, admin]);
    assert.fail("expected exception");
  } catch (e) { assert.match(e.message, /rejection reason is required/); }
  finally { await db.query("rollback"); }
});

test("admin approval grants verified status and writes an audit row", async () => {
  await db.query("begin");
  try {
    await db.query("select public.admin_review_student_verification($1,$2,'approved',null)", [pendingVerificationId, admin]);
    const p = await db.query("select is_verified from public.profiles where id=$1", [student]);
    assert.equal(p.rows[0].is_verified, true);
    const a = await db.query("select new_status from public.student_verification_audit where verification_id=$1", [pendingVerificationId]);
    assert.equal(a.rows[0].new_status, "approved");
  } finally { await db.query("rollback"); }
});

test("admin rejection keeps student unverified and records reason", async () => {
  await db.query("begin");
  try {
    await db.query("select public.admin_review_student_verification($1,$2,'rejected','Blurry document')", [pendingVerificationId, admin]);
    const p = await db.query("select is_verified from public.profiles where id=$1", [student]);
    assert.equal(p.rows[0].is_verified, false);
    const v = await db.query("select status, review_reason from public.student_verifications where id=$1", [pendingVerificationId]);
    assert.equal(v.rows[0].status, "rejected");
    assert.equal(v.rows[0].review_reason, "Blurry document");
  } finally { await db.query("rollback"); }
});

test("a reviewed request cannot be reviewed twice", async () => {
  await db.query("begin");
  try {
    await db.query("select public.admin_review_student_verification($1,$2,'approved',null)", [pendingVerificationId, admin]);
    await assert.rejects(
      db.query("select public.admin_review_student_verification($1,$2,'rejected','late')", [pendingVerificationId, admin]),
      /already been reviewed/);
  } finally { await db.query("rollback"); }
});

// ---------- Verified vs unverified social access ----------
test("unverified student cannot read posts", async () => {
  await db.query("insert into public.posts(user_id, content) values ($1,'secret campus news') ", [verified]).then(async () => {
    postId = (await db.query("select id from public.posts where content='secret campus news'")).rows[0].id;
  });
  const rows = await asUser(db, unverified, async (c) => (await c.query("select id from public.posts")).rows);
  assert.equal(rows.length, 0);
});

test("unverified student cannot create posts, likes or comments", async () => {
  await asUser(db, unverified, async (c) => {
    assert.ok(await fails(c, "insert into public.posts(user_id, content) values ($1,'x')", [unverified]));
    assert.ok(await fails(c, "insert into public.post_likes(post_id,user_id) values ($1,$2)", [postId, unverified]));
    assert.ok(await fails(c, "insert into public.post_comments(post_id,user_id,body) values ($1,$2,'hi')", [postId, unverified]));
  });
});

test("verified student can read posts, like and comment", async () => {
  await asUser(db, verified, async (c) => {
    assert.equal((await c.query("select id from public.posts")).rowCount, 1);
    assert.equal(await fails(c, "insert into public.post_likes(post_id,user_id) values ($1,$2)", [postId, verified]), null);
    assert.equal(await fails(c, "insert into public.post_comments(post_id,user_id,body) values ($1,$2,'nice')", [postId, verified]), null);
  });
});

test("student cannot post as another user", async () => {
  const err = await asUser(db, verified, (c) => fails(c, "insert into public.posts(user_id, content) values ($1,'spoof')", [otherVerified]));
  assert.ok(err);
});

test("students cannot delete another student's post", async () => {
  const rows = await asUser(db, otherVerified, async (c) => (await c.query("delete from public.posts where id=$1 returning id", [postId])).rows);
  assert.equal(rows.length, 0);
});

// ---------- Profile visibility ----------
test("unverified user sees only their own profile", async () => {
  const rows = await asUser(db, unverified, async (c) => (await c.query("select id from public.profiles")).rows);
  assert.deepEqual(rows.map((r) => r.id), [unverified]);
});

test("verified student sees verified peers but not unverified profiles", async () => {
  const ids = await asUser(db, verified, async (c) => (await c.query("select id from public.profiles")).rows.map((r) => r.id));
  assert.ok(ids.includes(verified) && ids.includes(otherVerified));
  assert.ok(!ids.includes(unverified), "unverified profile must be hidden from verified students");
  assert.ok(!ids.includes(student), "pending student profile must be hidden from verified students");
});

// ---------- Campus scoping (migration 0007) ----------
test("verified student at another college cannot see a campus-A post", async () => {
  const rows = await asUser(db, otherVerified, async (c) => (await c.query("select id from public.posts where id=$1", [postId])).rows);
  assert.equal(rows.length, 0);
});

test("verified student at another college cannot like or comment on a campus-A post", async () => {
  await asUser(db, otherVerified, async (c) => {
    assert.ok(await fails(c, "insert into public.post_likes(post_id,user_id) values ($1,$2)", [postId, otherVerified]));
    assert.ok(await fails(c, "insert into public.post_comments(post_id,user_id,body) values ($1,$2,'hi')", [postId, otherVerified]));
  });
});

test("verified student at the same college sees the post", async () => {
  const sameCollege = await createUser(db, { name: "Classmate", college: "Campus A", verified: true });
  const rows = await asUser(db, sameCollege, async (c) => (await c.query("select id from public.posts where id=$1", [postId])).rows);
  assert.equal(rows.length, 1);
});

test("a verified student with no college sees no campus posts from others", async () => {
  const orphan = await createUser(db, { name: "No college", college: "", verified: true });
  await db.query("update public.profiles set college_id = null where id = $1", [orphan]);
  const rows = await asUser(db, orphan, async (c) => (await c.query("select id from public.posts")).rows);
  assert.equal(rows.length, 0);
});

// ---------- Least privilege (migration 0008) ----------
test("authenticated users cannot TRUNCATE any public table", async () => {
  const err = await asUser(db, verified, (c) => fails(c, "truncate public.posts"));
  assert.match(err ?? "", /permission denied/);
});

test("authenticated users have no table privilege on the verification audit log", async () => {
  const { rows } = await db.query(
    "select has_table_privilege('authenticated','public.student_verification_audit','SELECT') as s, has_table_privilege('authenticated','public.student_verification_audit','INSERT') as i");
  assert.equal(rows[0].s, false);
  assert.equal(rows[0].i, false);
});

test("trigger and review functions are not executable by app roles", async () => {
  const { rows } = await db.query(`select
    has_function_privilege('authenticated','public.handle_new_campusly_user()','EXECUTE') as trig_auth,
    has_function_privilege('anon','public.handle_new_campusly_user()','EXECUTE') as trig_anon`);
  assert.equal(rows[0].trig_auth, false);
  assert.equal(rows[0].trig_anon, false);
});

test("campus events are limited to the viewer's college", async () => {
  const { rows: [{ id: campusA }] } = await db.query("select college_id as id from public.profiles where id=$1", [verified]);
  const { rows: [{ id: campusB }] } = await db.query("select college_id as id from public.profiles where id=$1", [otherVerified]);
  await db.query("insert into public.campus_events(college_id,title,starts_at) values ($1,'A event',now()), ($2,'B event',now())", [campusA, campusB]);
  const titles = await asUser(db, verified, async (c) => (await c.query("select title from public.campus_events order by title")).rows.map((r) => r.title));
  assert.deepEqual(titles, ["A event"]);
});

// ---------- Self-review block (migration 0009) ----------
test("an administrator cannot approve their own verification request", async () => {
  const { rows: [{ id: ownId }] } = await db.query(
    "insert into public.student_verifications(user_id,document_path,document_type,status) values ($1,$2,'college_id','pending') returning id",
    [admin, `${admin}/self.pdf`]);
  await db.query("begin");
  try {
    await assert.rejects(
      db.query("select public.admin_review_student_verification($1,$2,'approved',null)", [ownId, admin]),
      /cannot review their own/);
  } finally { await db.query("rollback"); }
});

// ---------- Comment replies (migration 0011) ----------
test("a reply to a comment on the same post is allowed", async () => {
  const { rows: [{ id: postA }] } = await db.query("insert into public.posts(user_id,content) values ($1,'reply target A') returning id", [verified]);
  const { rows: [{ id: parentA }] } = await db.query("insert into public.post_comments(post_id,user_id,body) values ($1,$2,'parent') returning id", [postA, verified]);
  const classmate = await createUser(db, { name: "Reply Classmate", college: "Campus A", verified: true });
  const err = await asUser(db, classmate, (c) => fails(c,
    "insert into public.post_comments(post_id,user_id,body,parent_id) values ($1,$2,'reply',$3)", [postA, classmate, parentA]));
  assert.equal(err, null);
});

test("a reply cannot point at a comment on a different post", async () => {
  const { rows: [{ id: postB }] } = await db.query("insert into public.posts(user_id,content) values ($1,'reply target B') returning id", [verified]);
  const { rows: [{ id: parentOnA }] } = await db.query(
    "insert into public.post_comments(post_id,user_id,body) select id,$1,'other' from public.posts where content='reply target A' returning id", [verified]);
  const err = await asUser(db, verified, (c) => fails(c,
    "insert into public.post_comments(post_id,user_id,body,parent_id) values ($1,$2,'bad reply',$3)", [postB, verified, parentOnA]));
  assert.ok(err, "expected the reply to be refused");
});

test("deleting a parent comment removes its replies", async () => {
  const { rows: [{ id: postC }] } = await db.query("insert into public.posts(user_id,content) values ($1,'cascade target') returning id", [verified]);
  const { rows: [{ id: parent }] } = await db.query("insert into public.post_comments(post_id,user_id,body) values ($1,$2,'p') returning id", [postC, verified]);
  await db.query("insert into public.post_comments(post_id,user_id,body,parent_id) values ($1,$2,'r',$3)", [postC, verified, parent]);
  await db.query("delete from public.post_comments where id = $1", [parent]);
  const { rows } = await db.query("select count(*)::int as n from public.post_comments where post_id = $1", [postC]);
  assert.equal(rows[0].n, 0);
});

// ---------- Friends and blocking (migration 0012) ----------
test("verified students can send a friend request, and it stays pending", async () => {
  const a = await createUser(db, { name: "Friend A", college: "Campus F", verified: true });
  const b = await createUser(db, { name: "Friend B", college: "Campus F", verified: true });
  const status = await asUser(db, a, async (c) => {
    await c.query("insert into public.friendships(requester_id,addressee_id) values ($1,$2)", [a, b]);
    return (await c.query("select status from public.friendships where requester_id=$1 and addressee_id=$2", [a, b])).rows[0].status;
  });
  assert.equal(status, "pending");
});

test("unverified students cannot send friend requests", async () => {
  const b = await createUser(db, { name: "Target", college: "Campus F", verified: true });
  const err = await asUser(db, unverified, (c) => fails(c,
    "insert into public.friendships(requester_id,addressee_id) values ($1,$2)", [unverified, b]));
  assert.ok(err);
});

test("a duplicate request in either direction is refused", async () => {
  const a = await createUser(db, { name: "Dup A", college: "Campus D", verified: true });
  const b = await createUser(db, { name: "Dup B", college: "Campus D", verified: true });
  await db.query("insert into public.friendships(requester_id,addressee_id) values ($1,$2)", [a, b]);
  const reverse = await asUser(db, b, (c) => fails(c,
    "insert into public.friendships(requester_id,addressee_id) values ($1,$2)", [b, a]));
  assert.ok(reverse, "reverse duplicate should be refused");
});

test("a student cannot send a friend request to themselves", async () => {
  const a = await createUser(db, { name: "Self", college: "Campus S", verified: true });
  const err = await asUser(db, a, (c) => fails(c,
    "insert into public.friendships(requester_id,addressee_id) values ($1,$1)", [a]));
  assert.ok(err);
});

test("only the addressee can accept a request", async () => {
  const a = await createUser(db, { name: "Acc A", college: "Campus X", verified: true });
  const b = await createUser(db, { name: "Acc B", college: "Campus X", verified: true });
  const { rows: [{ id }] } = await db.query("insert into public.friendships(requester_id,addressee_id) values ($1,$2) returning id", [a, b]);
  const requesterAccepts = await asUser(db, a, async (c) =>
    (await c.query("update public.friendships set status='accepted', responded_at=now() where id=$1 returning id", [id])).rowCount);
  assert.equal(requesterAccepts, 0);
  const addresseeAccepts = await asUser(db, b, async (c) =>
    (await c.query("update public.friendships set status='accepted', responded_at=now() where id=$1 returning id", [id])).rowCount);
  assert.equal(addresseeAccepts, 1);
});

test("a third party cannot see someone else's friendship", async () => {
  const a = await createUser(db, { name: "Pri A", college: "Campus P", verified: true });
  const b = await createUser(db, { name: "Pri B", college: "Campus P", verified: true });
  const c3 = await createUser(db, { name: "Pri C", college: "Campus P", verified: true });
  await db.query("insert into public.friendships(requester_id,addressee_id) values ($1,$2)", [a, b]);
  const rows = await asUser(db, c3, async (c) => (await c.query("select id from public.friendships where requester_id=$1", [a])).rows);
  assert.equal(rows.length, 0);
});

test("blocking removes an existing friendship and stops new requests", async () => {
  const a = await createUser(db, { name: "Blk A", college: "Campus B", verified: true });
  const b = await createUser(db, { name: "Blk B", college: "Campus B", verified: true });
  await db.query("insert into public.friendships(requester_id,addressee_id,status,responded_at) values ($1,$2,'accepted',now())", [a, b]);
  await asUser(db, a, (c) => c.query("insert into public.user_blocks(blocker_id,blocked_id) values ($1,$2)", [a, b]), { commit: true });
  const { rows } = await db.query("select id from public.friendships where requester_id=$1 and addressee_id=$2", [a, b]);
  assert.equal(rows.length, 0, "friendship should be removed when blocked");
  const err = await asUser(db, b, (c) => fails(c,
    "insert into public.friendships(requester_id,addressee_id) values ($1,$2)", [b, a]));
  assert.ok(err, "blocked pair cannot request each other");
  await db.query("delete from public.user_blocks where blocker_id=$1 and blocked_id=$2", [a, b]);
});

test("a blocked user's posts are hidden in both directions", async () => {
  const a = await createUser(db, { name: "Post A", college: "Campus PB", verified: true });
  const b = await createUser(db, { name: "Post B", college: "Campus PB", verified: true });
  const { rows: [{ id: postId }] } = await db.query("insert into public.posts(user_id,content) values ($1,'blocked content') returning id", [a]);
  await db.query("insert into public.user_blocks(blocker_id,blocked_id) values ($1,$2)", [a, b]);
  const seenByB = await asUser(db, b, async (c) => (await c.query("select id from public.posts where id=$1", [postId])).rows);
  assert.equal(seenByB.length, 0, "blocked viewer must not see the blocker's posts");
  const seenByA = await asUser(db, a, async (c) => (await c.query("select id from public.posts where id=$1", [postId])).rows);
  assert.equal(seenByA.length, 1, "author still sees their own post");
});

test("users cannot read other users' block lists", async () => {
  const a = await createUser(db, { name: "BL A", college: "Campus BL", verified: true });
  const b = await createUser(db, { name: "BL B", college: "Campus BL", verified: true });
  await db.query("insert into public.user_blocks(blocker_id,blocked_id) values ($1,$2)", [b, a]);
  const rows = await asUser(db, a, async (c) => (await c.query("select blocker_id from public.user_blocks")).rows);
  assert.equal(rows.length, 0);
});

// ---------- Notifications (migration 0013) ----------
test("a like on a post notifies its author, not the liker", async () => {
  const author = await createUser(db, { name: "Note Author", college: "Campus N", verified: true });
  const liker = await createUser(db, { name: "Note Liker", college: "Campus N", verified: true });
  const { rows: [{ id: postId }] } = await db.query("insert into public.posts(user_id,content) values ($1,'notify me') returning id", [author]);
  await db.query("insert into public.post_likes(post_id,user_id) values ($1,$2)", [postId, liker]);
  const { rows } = await db.query("select kind from public.notifications where recipient_id=$1", [author]);
  assert.deepEqual(rows.map((r) => r.kind), ["post_like"]);
  const self = await db.query("select count(*)::int as n from public.notifications where recipient_id=$1 and actor_id=$1", [author]);
  assert.equal(self.rows[0].n, 0);
});

test("a friend request and its acceptance each notify the right person", async () => {
  const a = await createUser(db, { name: "Note A", college: "Campus NF", verified: true });
  const b = await createUser(db, { name: "Note B", college: "Campus NF", verified: true });
  const { rows: [{ id }] } = await db.query("insert into public.friendships(requester_id,addressee_id) values ($1,$2) returning id", [a, b]);
  await db.query("update public.friendships set status='accepted', responded_at=now() where id=$1", [id]);
  const toB = await db.query("select kind from public.notifications where recipient_id=$1 and actor_id=$2", [b, a]);
  assert.deepEqual(toB.rows.map((r) => r.kind), ["friend_request"]);
  const toA = await db.query("select kind from public.notifications where recipient_id=$1 and actor_id=$2", [a, b]);
  assert.deepEqual(toA.rows.map((r) => r.kind), ["friend_accepted"]);
});

test("a reply notifies the parent comment's author", async () => {
  const postOwner = await createUser(db, { name: "Note Owner", college: "Campus NR", verified: true });
  const commenter = await createUser(db, { name: "Note Commenter", college: "Campus NR", verified: true });
  const replier = await createUser(db, { name: "Note Replier", college: "Campus NR", verified: true });
  const { rows: [{ id: postId }] } = await db.query("insert into public.posts(user_id,content) values ($1,'thread') returning id", [postOwner]);
  const { rows: [{ id: parent }] } = await db.query("insert into public.post_comments(post_id,user_id,body) values ($1,$2,'top') returning id", [postId, commenter]);
  await db.query("insert into public.post_comments(post_id,user_id,body,parent_id) values ($1,$2,'reply',$3)", [postId, replier, parent]);
  const { rows } = await db.query("select kind from public.notifications where recipient_id=$1 and actor_id=$2", [commenter, replier]);
  assert.deepEqual(rows.map((r) => r.kind), ["comment_reply"]);
});

test("blocked users generate no notifications", async () => {
  const author = await createUser(db, { name: "Blocked Author", college: "Campus NB", verified: true });
  const liker = await createUser(db, { name: "Blocked Liker", college: "Campus NB", verified: true });
  await db.query("insert into public.user_blocks(blocker_id,blocked_id) values ($1,$2)", [author, liker]);
  const { rows: [{ id: postId }] } = await db.query("insert into public.posts(user_id,content) values ($1,'quiet') returning id", [author]);
  await db.query("insert into public.post_likes(post_id,user_id) values ($1,$2)", [postId, liker]);
  const { rows } = await db.query("select count(*)::int as n from public.notifications where recipient_id=$1", [author]);
  assert.equal(rows[0].n, 0);
});

test("users read only their own notifications and cannot create them", async () => {
  const author = await createUser(db, { name: "Read Author", college: "Campus NRd", verified: true });
  const other = await createUser(db, { name: "Read Other", college: "Campus NRd", verified: true });
  const { rows: [{ id: postId }] } = await db.query("insert into public.posts(user_id,content) values ($1,'x') returning id", [author]);
  await db.query("insert into public.post_likes(post_id,user_id) values ($1,$2)", [postId, other]);
  const seenByOther = await asUser(db, other, async (c) => (await c.query("select id from public.notifications")).rows);
  assert.equal(seenByOther.length, 0);
  const forged = await asUser(db, other, (c) => fails(c,
    "insert into public.notifications(recipient_id,actor_id,kind) values ($1,$2,'post_like')", [author, other]));
  assert.ok(forged, "direct inserts must be refused");
});

test("a recipient can mark their notification read, but not change other fields", async () => {
  const author = await createUser(db, { name: "Mark Author", college: "Campus NM", verified: true });
  const liker = await createUser(db, { name: "Mark Liker", college: "Campus NM", verified: true });
  const { rows: [{ id: postId }] } = await db.query("insert into public.posts(user_id,content) values ($1,'m') returning id", [author]);
  await db.query("insert into public.post_likes(post_id,user_id) values ($1,$2)", [postId, liker]);
  const { rows: [{ id: nid }] } = await db.query("select id from public.notifications where recipient_id=$1", [author]);
  const marked = await asUser(db, author, async (c) =>
    (await c.query("update public.notifications set read_at=now() where id=$1 returning id", [nid])).rowCount);
  assert.equal(marked, 1);
  const changeKind = await asUser(db, author, (c) => fails(c,
    "update public.notifications set kind='friend_request' where id=$1", [nid]));
  assert.match(changeKind ?? "", /permission denied/);
});
