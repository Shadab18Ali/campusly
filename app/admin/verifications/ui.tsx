"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, RefreshCw, FileText, Clock3, GraduationCap, ExternalLink, AlertCircle } from "lucide-react";

type Verification = {
  id: string;
  user_id: string;
  document_type: string;
  status: string;
  submitted_at: string;
  signed_url: string;
  student: {
    full_name: string;
    department: string | null;
    course: string | null;
    graduation_year: number | null;
    college: { name: string; city: string | null; state: string | null } | null;
    email: string | null;
  };
};

const prettyDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function AdminVerifications() {
  const [items, setItems] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Verification | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/verifications", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load verification requests.");
      setItems(body.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load requests.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(item: Verification, decision: "approved" | "rejected") {
    const reason = (reasons[item.id] || "").trim();
    if (decision === "rejected" && !reason) {
      setError("Add a short reason before rejecting a document.");
      return;
    }
    setBusyId(item.id); setError("");
    try {
      const response = await fetch("/api/admin/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId: item.id, decision, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Review could not be saved.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (preview?.id === item.id) setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review could not be saved.");
    } finally { setBusyId(""); }
  }

  return (
    <section className="mt-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div><p className="text-sm font-black text-slate-900">Pending applications</p><p className="mt-1 text-xs text-slate-500">{items.length} awaiting review</p></div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs font-bold hover:border-blue-500 disabled:opacity-50"><RefreshCw size={14}/> Refresh</button>
      </div>
      {error && <div role="alert" className="mb-4 flex items-start gap-2 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{error}</div>}
      {loading ? <div className="border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading applications…</div>
        : items.length === 0 ? <div className="border border-dashed border-slate-300 bg-white p-12 text-center"><Check className="mx-auto text-emerald-600" size={30}/><h2 className="mt-3 text-lg font-black">You’re all caught up.</h2><p className="mt-1 text-sm text-slate-500">New student verification requests will appear here.</p></div>
        : <div className="space-y-4">{items.map((item) => <article key={item.id} className="grid gap-5 border border-slate-200 bg-white p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">Pending</span><span className="text-xs text-slate-400"><Clock3 className="mr-1 inline" size={12}/>{prettyDate(item.submitted_at)}</span></div>
            <h2 className="mt-3 text-xl font-black">{item.student.full_name || "Student"}</h2>
            <p className="mt-1 text-sm text-slate-500">{item.student.email || "Email unavailable"}</p>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex gap-2"><GraduationCap size={17} className="mt-0.5 text-slate-400"/><span><b>{item.student.college?.name || "College not provided"}</b><small className="block text-xs text-slate-500">{[item.student.college?.city, item.student.college?.state].filter(Boolean).join(", ")}</small></span></div>
              <div><b className="text-slate-700">{item.student.course || "Course not provided"}</b><small className="block text-xs text-slate-500">{[item.student.department, item.student.graduation_year ? "Graduating " + item.student.graduation_year : null].filter(Boolean).join(" · ")}</small></div>
              <div className="text-xs text-slate-500">Document: <b className="text-slate-800">{item.document_type.replaceAll("_", " ")}</b></div>
            </div>
            <label className="mt-5 block text-xs font-bold text-slate-600">Review note <span className="font-normal text-slate-400">(required when rejecting)</span><textarea value={reasons[item.id] || ""} onChange={(e) => setReasons((v) => ({ ...v, [item.id]: e.target.value }))} maxLength={500} rows={2} placeholder="Explain what needs correction, if any…" className="input mt-2 resize-y text-sm"/></label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => void review(item, "approved")} disabled={!!busyId} className="inline-flex items-center gap-2 bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><Check size={16}/>{busyId === item.id ? "Saving…" : "Approve student"}</button>
              <button onClick={() => void review(item, "rejected")} disabled={!!busyId} className="inline-flex items-center gap-2 border border-rose-300 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><X size={16}/> Reject</button>
            </div>
          </div>
          <div className="min-w-0">
            <button onClick={() => setPreview(item)} className="group flex min-h-44 w-full flex-col items-center justify-center gap-3 border border-dashed border-slate-300 bg-slate-50 p-5 text-center hover:border-blue-400"><FileText size={32} className="text-slate-400"/><span className="text-sm font-bold">Preview private document</span><span className="text-xs text-slate-500">Temporary secure link</span><ExternalLink size={14} className="text-blue-600"/></button>
          </div>
        </article>)}</div>}
      {preview && <div role="dialog" aria-modal="true" aria-label="Document preview" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-3 md:p-8" onClick={() => setPreview(null)}>
        <div className="flex max-h-[92vh] w-full max-w-5xl flex-col bg-white p-3 md:p-5" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between gap-3"><div><b className="text-sm">{preview.student.full_name} — student document</b><p className="text-xs text-slate-500">Private preview link expires shortly</p></div><button onClick={() => setPreview(null)} aria-label="Close preview" className="border px-3 py-2 text-sm font-bold">Close</button></div>
          {preview.signed_url.toLowerCase().includes(".pdf") ? <iframe title="Student document PDF" src={preview.signed_url} className="min-h-[65vh] w-full border"/> : <img src={preview.signed_url} alt="Submitted student identity document" className="max-h-[75vh] w-full object-contain bg-slate-100"/>}
        </div>
      </div>}
    </section>
  );
}
