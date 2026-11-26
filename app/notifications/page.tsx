"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Bell } from "lucide-react";

type Note = {
  id: string;
  kind: "friend_request" | "friend_accepted" | "post_like" | "post_comment" | "comment_reply";
  read_at: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
};

const text = (n: Note) => {
  const who = n.profiles?.full_name || "A student";
  switch (n.kind) {
    case "friend_request": return `${who} sent you a friend request.`;
    case "friend_accepted": return `${who} accepted your friend request.`;
    case "post_like": return `${who} liked your post.`;
    case "post_comment": return `${who} commented on your post.`;
    case "comment_reply": return `${who} replied to your comment.`;
  }
};

const when = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function NotificationsPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const sb = createClient();
      const { data: { user }, error: authError } = await sb.auth.getUser();
      if (authError || !user) { router.replace("/login?next=/notifications"); return; }
      const { data, error } = await sb.from("notifications")
        .select("id,kind,read_at,created_at,profiles!notifications_actor_id_fkey(full_name)")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      setNotes((data || []) as unknown as Note[]);
      // Mark everything read once the list has been shown.
      await sb.from("notifications").update({ read_at: new Date().toISOString() })
        .eq("recipient_id", user.id).is("read_at", null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-violet-600"><ArrowLeft size={16} /> Campus feed</Link>
        <h1 className="mt-4 flex items-center gap-3 text-3xl font-black"><Bell size={26} /> Notifications</h1>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {loading ? <p className="mt-8 text-sm text-slate-500">Loading…</p> : (
          <ul className="mt-6 space-y-3">
            {notes.map((n) => (
              <li key={n.id} className={"card flex items-start justify-between gap-4 p-4 " + (n.read_at ? "" : "border-violet-300")}>
                <div>
                  <p className="text-sm">{text(n)}</p>
                  <p className="mt-1 text-xs text-slate-400">{when(n.created_at)}</p>
                </div>
                {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-600" aria-label="Unread" />}
              </li>
            ))}
            {notes.length === 0 && <li className="card p-6 text-center text-sm text-slate-500">No notifications yet. Likes, comments and friend requests will appear here.</li>}
          </ul>
        )}
      </div>
    </main>
  );
}
