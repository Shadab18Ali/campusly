import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { getAdminSession } from "@/lib/supabase/admin-auth";
import AdminVerifications from "./ui";

export const dynamic = "force-dynamic";

export default async function AdminVerificationsPage() {
  const { user, isAdmin } = await getAdminSession();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/dashboard");

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700"><ArrowLeft size={16}/> Back to Campusly</Link>
        <header className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-slate-900 pb-5">
          <div>
            <p className="eyebrow"><ShieldCheck size={14} className="mr-1 inline"/> CAMPUSLY / ADMIN</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Student verification</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Review submitted college documents. Only approved students can access the campus network.</p>
          </div>
          <span className="border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">{user.email}</span>
        </header>
        <AdminVerifications />
      </div>
    </main>
  );
}
