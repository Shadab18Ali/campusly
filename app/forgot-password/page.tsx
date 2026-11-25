"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function ForgotPassword(){
 const [email,setEmail]=useState(""); const [busy,setBusy]=useState(false); const [sent,setSent]=useState(false); const [error,setError]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const sb=createClient();const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/reset-password"});if(error)throw error;setSent(true);}catch(e){setError(e instanceof Error?e.message:"Could not send reset email.");}finally{setBusy(false);}}
 return <main className="grid min-h-screen place-items-center px-5"><section className="card w-full max-w-md p-8"><Link href="/login" className="text-sm font-bold text-violet-600">← Back to login</Link><h1 className="mt-8 text-3xl font-black">Forgot your password?</h1><p className="mt-2 text-sm leading-6 text-slate-500">Enter the email you used for Campusly. We will send you a secure reset link.</p>{sent?<div role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">If an account exists for <b>{email}</b>, a password reset link is on its way. Check your inbox.</div>:<form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-bold">Email address<input required type="email" className="input mt-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>{error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}<button disabled={busy} className="btn w-full">{busy?"Sending…":"Send reset link"}</button></form>}</section></main>;
}
