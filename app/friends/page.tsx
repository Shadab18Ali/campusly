"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Ban, Check, UserPlus, X } from "lucide-react";

type Person = { id: string; full_name: string; college_id: string | null };
type Friendship = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted" };

export default function FriendsPage() {
  const router = useRouter();
  const [sb, setSb] = useState<ReturnType<typeof createClient> | null>(null);
  const [me, setMe] = useState("");
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { try { setSb(createClient()); } catch { setLoading(false); } }, []);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) { router.replace("/login?next=/friends"); return; }
    setMe(user.id);
    const [{ data: f }, { data: b }] = await Promise.all([
      sb.from("friendships").select("id,requester_id,addressee_id,status"),
      sb.from("user_blocks").select("blocked_id").eq("blocker_id", user.id),
    ]);
    const rows = (f || []) as Friendship[];
    setFriendships(rows);
    setBlocked((b || []).map((x) => x.blocked_id));
    const ids = Array.from(new Set(rows.flatMap((r) => [r.requester_id, r.addressee_id]).filter((id) => id !== user.id)));
    if (ids.length) {
      const { data: profiles } = await sb.from("profiles").select("id,full_name,college_id").in("id", ids);
      setPeople(Object.fromEntries(((profiles || []) as Person[]).map((p) => [p.id, p])));
    }
    setLoading(false);
  }, [sb, router]);

  useEffect(() => { void load(); }, [load]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!sb || query.trim().length < 2) { setResults([]); return; }
    const { data } = await sb.from("profiles").select("id,full_name,college_id")
      .ilike("full_name", `%${query.trim()}%`).neq("id", me).limit(20);
    setResults((data || []) as Person[]);
  }

  async function act(action: () => PromiseLike<{ error: { message: string } | null }>, done: string) {
    const { error } = await action();
    if (error) setMessage(error.message); else { setMessage(done); await load(); }
  }

  const sendRequest = (id: string) => sb && act(() => sb.from("friendships").insert({ requester_id: me, addressee_id: id }), "Friend request sent.");
  const accept = (id: string) => sb && act(() => sb.from("friendships").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", id), "Request accepted.");
  const removeRow = (id: string, msg: string) => sb && act(() => sb.from("friendships").delete().eq("id", id), msg);
  const block = (id: string) => sb && act(() => sb.from("user_blocks").insert({ blocker_id: me, blocked_id: id }), "User blocked.");
  const unblock = (id: string) => sb && act(() => sb.from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", id), "User unblocked.");

  const name = (id: string) => people[id]?.full_name || "Student";
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === me);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === me);
  const friends = friendships.filter((f) => f.status === "accepted");
  const otherOf = (f: Friendship) => (f.requester_id === me ? f.addressee_id : f.requester_id);
  const relationOf = (id: string) => friendships.find((f) => otherOf(f) === id);

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-violet-600"><ArrowLeft size={16} /> Campus feed</Link>
        <h1 className="mt-4 text-3xl font-black">Friends</h1>
        <p className="mt-2 text-sm text-slate-500">Connect with verified students. Blocking hides each other's posts and removes any friendship.</p>
        {message && <p role="status" className="mt-4 rounded-xl bg-violet-50 p-3 text-sm text-violet-800">{message}</p>}
        {loading ? <p className="mt-8 text-sm text-slate-500">Loading…</p> : (
          <>
            <section className="card mt-6 p-5">
              <h2 className="font-black">Find students</h2>
              <form onSubmit={search} className="mt-3 flex gap-2">
                <input className="input flex-1" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search students" />
                <button className="btn">Search</button>
              </form>
              <ul className="mt-4 space-y-3">
                {results.map((p) => {
                  const rel = relationOf(p.id);
                  const isBlocked = blocked.includes(p.id);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <span className="font-bold">{p.full_name}</span>
                      <span className="flex gap-2">
                        {isBlocked ? <button className="text-xs font-bold text-slate-600" onClick={() => unblock(p.id)}>Unblock</button>
                          : rel ? <span className="text-xs text-slate-500">{rel.status === "accepted" ? "Friends" : "Request pending"}</span>
                          : <button className="inline-flex items-center gap-1 text-xs font-bold text-violet-600" onClick={() => sendRequest(p.id)}><UserPlus size={14} /> Add friend</button>}
                        {!isBlocked && <button className="inline-flex items-center gap-1 text-xs font-bold text-rose-600" onClick={() => block(p.id)}><Ban size={14} /> Block</button>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="card mt-6 p-5">
              <h2 className="font-black">Requests for you ({incoming.length})</h2>
              <ul className="mt-3 space-y-3">
                {incoming.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3">
                    <span className="font-bold">{name(f.requester_id)}</span>
                    <span className="flex gap-2">
                      <button className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700" onClick={() => accept(f.id)}><Check size={14} /> Accept</button>
                      <button className="inline-flex items-center gap-1 text-xs font-bold text-slate-600" onClick={() => removeRow(f.id, "Request declined.")}><X size={14} /> Decline</button>
                    </span>
                  </li>
                ))}
                {incoming.length === 0 && <li className="text-sm text-slate-500">No pending requests.</li>}
              </ul>
            </section>

            <section className="card mt-6 p-5">
              <h2 className="font-black">Sent requests ({outgoing.length})</h2>
              <ul className="mt-3 space-y-3">
                {outgoing.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3">
                    <span className="font-bold">{name(f.addressee_id)}</span>
                    <button className="text-xs font-bold text-slate-600" onClick={() => removeRow(f.id, "Request cancelled.")}>Cancel</button>
                  </li>
                ))}
                {outgoing.length === 0 && <li className="text-sm text-slate-500">No sent requests.</li>}
              </ul>
            </section>

            <section className="card mt-6 p-5">
              <h2 className="font-black">Your friends ({friends.length})</h2>
              <ul className="mt-3 space-y-3">
                {friends.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3">
                    <span className="font-bold">{name(otherOf(f))}</span>
                    <button className="text-xs font-bold text-slate-600" onClick={() => removeRow(f.id, "Friend removed.")}>Remove</button>
                  </li>
                ))}
                {friends.length === 0 && <li className="text-sm text-slate-500">No friends yet. Search above to find classmates.</li>}
              </ul>
            </section>

            <section className="card mt-6 p-5">
              <h2 className="font-black">Blocked ({blocked.length})</h2>
              <ul className="mt-3 space-y-3">
                {blocked.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3">
                    <span className="font-bold">{name(id)}</span>
                    <button className="text-xs font-bold text-violet-600" onClick={() => unblock(id)}>Unblock</button>
                  </li>
                ))}
                {blocked.length === 0 && <li className="text-sm text-slate-500">You haven't blocked anyone.</li>}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
